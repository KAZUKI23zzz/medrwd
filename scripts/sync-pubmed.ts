/**
 * PubMed論文収集スクリプト（収集専任）
 * Claude Routine から週次で実行される。
 *
 * 役割:
 * 1. PubMed esearch → hasabstract 付きで新着論文のPMID取得（アブストありのみ）
 * 2. PubMed efetch → メタデータ取得（XML）
 * 3. OpenAlex → 雑誌IF取得
 * 4. classified:false で papers.json に追記
 *
 * 分類・日本語要約・偽陽性除外は Routine(LLM) が担当する（docs/routine-classify.md 参照）。
 * このスクリプトはキーワード分類や翻訳を行わない。
 */

import * as fs from "fs";
import * as path from "path";

// --- Types ---
interface Paper {
  id: string;
  pubmed_id: string;
  doi: string | null;
  title: string;
  title_ja?: string;
  abstract: string;
  abstract_ja?: string;
  authors: string[];
  journal: string;
  journal_issn: string | null;
  year: number;
  publication_date: string;
  databases_used: string[];
  additional_data_sources: string[];
  study_design: string;
  analysis_methods: string[];
  mesh_terms: string[];
  impact_factor: number | null;
  sjr_quartile: string | null;
  research_categories: string[];
  auto_detected: boolean;
  collected_at: string;
  classified: boolean;
  medline_status?: string;
  last_updated?: string;
}

// 収集スクリプトが設定しないフィールド（分類・要約は Routine が後から埋める）
type ParsedArticle = Omit<
  Paper,
  | "databases_used"
  | "additional_data_sources"
  | "study_design"
  | "research_categories"
  | "impact_factor"
  | "sjr_quartile"
  | "auto_detected"
  | "collected_at"
  | "classified"
  | "last_updated"
>;

// --- PubMed API ---
const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const SEARCH_QUERIES = [
  '(((Japan[MeSH] OR Japan[TIAB] OR Japanese[TIAB]) AND ("claims-based"[TIAB] OR "claims based"[TIAB] OR "claims database"[TIAB] OR "claims databases"[TIAB] OR "administrative database"[TIAB] OR "administrative databases"[TIAB] OR "healthcare database"[TIAB] OR "healthcare databases"[TIAB] OR "insurance database"[TIAB] OR "insurance databases"[TIAB] OR "electronic medical record database"[TIAB] OR "electronic medical record databases"[TIAB] OR "electronic health record database"[TIAB] OR "electronic health record databases"[TIAB] OR "routinely collected health data"[MeSH] OR "target trial emulation"[TIAB] OR "JMDC"[TIAB] OR "Japan Medical Data Center"[TIAB] OR "DPC"[TIAB] OR "Diagnosis Procedure Combination"[TIAB] OR "NDB"[TIAB] OR "National Database of Health Insurance Claims"[TIAB] OR "MDV"[TIAB] OR "Medical Data Vision"[TIAB] OR "NCD"[TIAB] OR "National Clinical Database"[TIAB] OR "MID-NET"[TIAB] OR "JADER"[TIAB] OR "Japanese Adverse Drug Event Report database"[TIAB])) NOT ("Clinical Trial"[PT] OR "review"[PT] OR "Meta-Analysis"[PT] OR "randomized controlled trial"[PT])) AND hasabstract',
];

// Centralized rate limiter for PubMed E-utilities (3 req/s without API key)
let lastPubMedRequestTime = 0;
const PUBMED_MIN_INTERVAL_MS = 350;

async function pubmedFetch(url: string): Promise<Response> {
  // Enforce minimum interval between all PubMed requests
  const elapsed = Date.now() - lastPubMedRequestTime;
  if (elapsed < PUBMED_MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, PUBMED_MIN_INTERVAL_MS - elapsed));
  }
  lastPubMedRequestTime = Date.now();

  const res = await fetch(url);
  if (res.status === 429) {
    // Safety net: wait and retry once if rate-limited despite throttling
    console.log("  Rate limited (429), waiting 3s before retry...");
    await new Promise((r) => setTimeout(r, 3000));
    lastPubMedRequestTime = Date.now();
    const retry = await fetch(url);
    if (!retry.ok) throw new Error(`HTTP ${retry.status}: ${url}`);
    return retry;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

async function pubmedFetchJSON(url: string): Promise<unknown> {
  const res = await pubmedFetch(url);
  return res.json();
}

async function pubmedFetchText(url: string): Promise<string> {
  const res = await pubmedFetch(url);
  return res.text();
}

async function searchPubMed(
  query: string,
  days: number = 30
): Promise<string[]> {
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&reldate=${days}&retmax=100&retmode=json`;
  const data = (await pubmedFetchJSON(url)) as {
    esearchresult: { idlist: string[] };
  };
  return data.esearchresult.idlist;
}

// Decode HTML/XML numeric character references (&#x2009; → thin space, &#169; → ©, etc.)
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Simple XML parser for PubMed efetch results
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  let match;
  while ((match = re.exec(xml)) !== null) {
    results.push(decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim()));
  }
  return results;
}

function parseArticleXML(articleXml: string): ParsedArticle | null {
  const pmid = extractTag(articleXml, "PMID");
  if (!pmid) return null;

  // MedlineCitation Status: "MEDLINE", "In-Process", "Publisher", "PubMed-not-MEDLINE"
  const statusMatch = articleXml.match(/<MedlineCitation\s[^>]*Status="([^"]+)"/);
  const medline_status = statusMatch ? statusMatch[1] : undefined;

  const title = extractTag(articleXml, "ArticleTitle");
  const abstractTexts = extractAllTags(articleXml, "AbstractText");
  const abstract = abstractTexts.join(" ");
  const journal = extractTag(articleXml, "Title");

  // ISSN
  const issnMatch = articleXml.match(/<ISSN[^>]*>([^<]+)<\/ISSN>/);
  const journal_issn = issnMatch ? issnMatch[1] : null;

  // DOI
  const doiMatch = articleXml.match(
    /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/
  );
  const doi = doiMatch ? doiMatch[1] : null;

  // Authors
  const authorBlocks = articleXml.match(
    /<Author[^>]*>[\s\S]*?<\/Author>/g
  ) || [];
  const authors = authorBlocks.map((block) => {
    const last = extractTag(block, "LastName");
    const initials = extractTag(block, "Initials");
    return `${last} ${initials}`.trim();
  }).filter(Boolean);

  // Publication date
  const yearStr = extractTag(articleXml, "Year");
  const monthStr = extractTag(articleXml, "Month");
  const dayStr = extractTag(articleXml, "Day");
  const year = parseInt(yearStr) || new Date().getFullYear();
  const month = monthStr.padStart(2, "0");
  const day = dayStr.padStart(2, "0") || "01";
  const publication_date = `${year}-${month}-${day}`;

  // MeSH terms
  const meshDescriptors = extractAllTags(articleXml, "DescriptorName");
  const mesh_terms = [...new Set(meshDescriptors)];

  return {
    id: `pmid-${pmid}`,
    pubmed_id: pmid,
    doi,
    title,
    abstract,
    authors,
    journal,
    journal_issn,
    year,
    publication_date,
    analysis_methods: [],
    mesh_terms,
    medline_status,
  };
}

async function fetchPubMedArticles(pmids: string[]): Promise<(ParsedArticle | null)[]> {
  if (pmids.length === 0) return [];

  // Batch in groups of 50
  const results: (ParsedArticle | null)[] = [];
  for (let i = 0; i < pmids.length; i += 50) {
    const batch = pmids.slice(i, i + 50);
    const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${batch.join(",")}&retmode=xml`;
    const xml = await pubmedFetchText(url);

    // Split into individual articles
    const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
    for (const articleXml of articles) {
      results.push(parseArticleXML(articleXml));
    }
  }
  return results;
}

// --- OpenAlex API ---
const journalIFCache = new Map<string, { impact_factor: number | null; sjr_quartile: string | null }>();

async function getJournalMetrics(issn: string): Promise<{ impact_factor: number | null; sjr_quartile: string | null }> {
  if (journalIFCache.has(issn)) return journalIFCache.get(issn)!;

  try {
    const url = `https://api.openalex.org/sources?filter=issn:${issn}&mailto=rwd-catalog@example.com`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
    const data = (await res.json()) as {
      results: {
        summary_stats?: { "2yr_mean_citedness"?: number };
      }[];
    };

    let impact_factor: number | null = null;
    if (data.results?.[0]?.summary_stats?.["2yr_mean_citedness"]) {
      impact_factor = Math.round(data.results[0].summary_stats["2yr_mean_citedness"] * 100) / 100;
    }

    const result = { impact_factor, sjr_quartile: null };
    journalIFCache.set(issn, result);
    return result;
  } catch {
    const result = { impact_factor: null, sjr_quartile: null };
    journalIFCache.set(issn, result);
    return result;
  }
}

// --- Main ---
async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const papersPath = path.join(dataDir, "papers.json");

  // Load existing papers
  const existingPapers: Paper[] = JSON.parse(
    fs.readFileSync(papersPath, "utf-8")
  );
  const existingPmids = new Set(existingPapers.map((p) => p.pubmed_id));

  console.log(`Existing papers: ${existingPapers.length}`);

  // Search PubMed for new papers (hasabstract で絞り込み済み)
  const allPmids = new Set<string>();
  for (const query of SEARCH_QUERIES) {
    const days = existingPapers.length === 0 ? 365 : 14;
    console.log(`Searching PubMed (last ${days} days, hasabstract)...`);
    const pmids = await searchPubMed(query, days);
    pmids.forEach((id) => allPmids.add(id));
  }

  // Filter out already collected
  const newPmids = [...allPmids].filter((id) => !existingPmids.has(id));
  console.log(`New PMIDs found: ${newPmids.length}`);

  if (newPmids.length === 0) {
    console.log("No new papers found. Exiting.");
    return;
  }

  console.log("Fetching article metadata...");
  const articles = await fetchPubMedArticles(newPmids);

  const newPapers: Paper[] = [];
  for (const article of articles) {
    if (!article) continue;

    // hasabstract で取得しているが、念のため空アブストは弾く
    if (!article.abstract || article.abstract.trim().length === 0) {
      console.log(`  Skip ${article.pubmed_id}: no abstract`);
      continue;
    }

    // 雑誌IF（OpenAlex）
    let metrics = { impact_factor: null as number | null, sjr_quartile: null as string | null };
    if (article.journal_issn) {
      metrics = await getJournalMetrics(article.journal_issn);
    }

    // 分類・要約は Routine が後から埋める。ここでは空で出力し classified:false にする。
    const paper: Paper = {
      ...article,
      databases_used: [],
      additional_data_sources: [],
      study_design: "",
      analysis_methods: [],
      research_categories: [],
      impact_factor: metrics.impact_factor,
      sjr_quartile: metrics.sjr_quartile,
      auto_detected: true,
      collected_at: new Date().toISOString(),
      classified: false,
    };

    newPapers.push(paper);
  }

  console.log(`Collected ${newPapers.length} new papers (classified:false)`);

  if (newPapers.length === 0) {
    console.log("No changes to save. Exiting.");
    return;
  }

  const allPapers = [...existingPapers, ...newPapers].sort(
    (a, b) => b.year - a.year || b.publication_date.localeCompare(a.publication_date)
  );

  fs.writeFileSync(papersPath, JSON.stringify(allPapers, null, 2), "utf-8");
  console.log(`Total papers saved: ${allPapers.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
