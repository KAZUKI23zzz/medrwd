/**
 * PubMed論文収集スクリプト
 * GitHub Actionsから毎日実行される。
 *
 * 処理フロー:
 * 1. PubMed esearch → 新着論文のPMID取得
 * 2. PubMed efetch → メタデータ取得（XML）
 * 3. OpenAlex → 雑誌IF取得
 * 4. db-detector → アブストからDB名・研究デザイン検出
 * 5. papers.json に追記
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
  disease_area: string[];
  mesh_terms: string[];
  impact_factor: number | null;
  sjr_quartile: string | null;
  research_categories: string[];
  auto_detected: boolean;
  collected_at: string;
}

// --- DB Detection (inline to avoid TS module issues in scripts) ---
interface KeywordEntry {
  patterns: string[];
  display: string;
}

interface KeywordsData {
  databases: (KeywordEntry & { id: string })[];
  additional_sources: KeywordEntry[];
  research_categories: KeywordEntry[];
  study_designs: KeywordEntry[];
}

function matchPatterns(text: string, entries: KeywordEntry[]): string[] {
  const matches: string[] = [];
  for (const entry of entries) {
    for (const pattern of entry.patterns) {
      if (new RegExp(pattern, "i").test(text)) {
        matches.push(entry.display);
        break;
      }
    }
  }
  return matches;
}

function countPatternMatches(text: string, patterns: string[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches) count += matches.length;
  }
  return count;
}

// --- PubMed API ---
const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const SEARCH_QUERIES = [
  '(NDB OR "National Database" OR DPC OR JADER OR MID-NET OR JMDC OR MDV OR "Medical Data Vision" OR "Japan Medical Data Center") AND Japan AND (claims OR "real world" OR pharmacoepidemiology OR "database study" OR retrospective OR nationwide)',
];

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

async function searchPubMed(
  query: string,
  days: number = 30
): Promise<string[]> {
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&reldate=${days}&retmax=100&retmode=json`;
  const data = (await fetchJSON(url)) as {
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

function parseArticleXML(articleXml: string): Omit<Paper, "impact_factor" | "sjr_quartile" | "databases_used" | "additional_data_sources" | "study_design" | "research_categories" | "auto_detected" | "collected_at"> | null {
  const pmid = extractTag(articleXml, "PMID");
  if (!pmid) return null;

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
    disease_area: [],
    mesh_terms,
  };
}

async function fetchPubMedArticles(pmids: string[]): Promise<ReturnType<typeof parseArticleXML>[]> {
  if (pmids.length === 0) return [];

  // Batch in groups of 50
  const results: ReturnType<typeof parseArticleXML>[] = [];
  for (let i = 0; i < pmids.length; i += 50) {
    const batch = pmids.slice(i, i + 50);
    const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${batch.join(",")}&retmode=xml`;
    const xml = await fetchText(url);

    // Split into individual articles
    const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
    for (const articleXml of articles) {
      results.push(parseArticleXML(articleXml));
    }

    // Rate limiting: 3 req/s without API key
    if (i + 50 < pmids.length) {
      await new Promise((r) => setTimeout(r, 400));
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
    const data = (await fetchJSON(url)) as {
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

// --- Translation (Google Translate free endpoint) ---
async function translateText(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return "";

  const MAX_CHARS = 4500;
  if (text.length > MAX_CHARS) {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHARS) {
        chunks.push(remaining);
        break;
      }
      let idx = remaining.lastIndexOf(". ", MAX_CHARS);
      if (idx === -1 || idx < MAX_CHARS * 0.5) idx = remaining.lastIndexOf(" ", MAX_CHARS);
      if (idx === -1) idx = MAX_CHARS;
      chunks.push(remaining.slice(0, idx + 1));
      remaining = remaining.slice(idx + 1);
    }
    const translated: string[] = [];
    for (const chunk of chunks) {
      translated.push(await translateChunk(chunk));
      await new Promise((r) => setTimeout(r, 500));
    }
    return translated.join("");
  }
  return translateChunk(text);
}

async function translateChunk(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
  const data = (await res.json()) as [Array<[string, string]>];
  return data[0].map((seg) => seg[0]).join("");
}

// --- Main ---
async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const papersPath = path.join(dataDir, "papers.json");
  const keywordsPath = path.join(dataDir, "db-keywords.json");

  // Load existing papers
  const existingPapers: Paper[] = JSON.parse(
    fs.readFileSync(papersPath, "utf-8")
  );
  const existingPmids = new Set(existingPapers.map((p) => p.pubmed_id));

  // Load keywords
  const keywords: KeywordsData = JSON.parse(
    fs.readFileSync(keywordsPath, "utf-8")
  );

  console.log(`Existing papers: ${existingPapers.length}`);

  // Search PubMed for new papers
  const allPmids = new Set<string>();
  for (const query of SEARCH_QUERIES) {
    const days = existingPapers.length === 0 ? 365 : 7;
    console.log(`Searching PubMed (last ${days} days)...`);
    const pmids = await searchPubMed(query, days);
    pmids.forEach((id) => allPmids.add(id));
  }

  // Filter out already collected
  const newPmids = [...allPmids].filter((id) => !existingPmids.has(id));
  console.log(`New PMIDs found: ${newPmids.length}`);

  if (newPmids.length === 0) {
    console.log("No new papers. Exiting.");
    return;
  }

  // Fetch article metadata
  console.log("Fetching article metadata...");
  const articles = await fetchPubMedArticles(newPmids);

  // Process each article
  const newPapers: Paper[] = [];
  for (const article of articles) {
    if (!article) continue;

    // Detect databases, study design, and research categories
    const detectText = `${article.title} ${article.abstract} ${article.mesh_terms.join(" ")}`;
    const detection = {
      databases_used: matchPatterns(detectText, keywords.databases),
      additional_data_sources: matchPatterns(detectText, keywords.additional_sources),
      study_design: matchPatterns(detectText, keywords.study_designs)[0] || "その他",
    };

    // Research categories: score each category, take top 2
    const categoryScores: { display: string; score: number }[] = [];
    for (const cat of keywords.research_categories) {
      const score = countPatternMatches(detectText, cat.patterns);
      if (score > 0) {
        categoryScores.push({ display: cat.display, score });
      }
    }
    categoryScores.sort((a, b) => b.score - a.score);
    const research_categories =
      categoryScores.length > 0
        ? categoryScores.slice(0, 2).map((c) => c.display)
        : ["その他"];

    // Get journal metrics from OpenAlex
    let metrics = { impact_factor: null as number | null, sjr_quartile: null as string | null };
    if (article.journal_issn) {
      metrics = await getJournalMetrics(article.journal_issn);
    }

    // Translate title and abstract to Japanese
    let title_ja: string | undefined;
    let abstract_ja: string | undefined;
    try {
      title_ja = await translateText(article.title);
      await new Promise((r) => setTimeout(r, 300));
      if (article.abstract) {
        abstract_ja = await translateText(article.abstract);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (e) {
      console.warn(`Translation failed for ${article.id}:`, e);
    }

    const paper: Paper = {
      ...article,
      title_ja,
      abstract_ja,
      databases_used: detection.databases_used,
      additional_data_sources: detection.additional_data_sources,
      study_design: detection.study_design,
      research_categories,
      impact_factor: metrics.impact_factor,
      sjr_quartile: metrics.sjr_quartile,
      auto_detected: true,
      collected_at: new Date().toISOString(),
    };

    newPapers.push(paper);
  }

  console.log(`Processed ${newPapers.length} new papers`);

  // Merge and save
  const allPapers = [...existingPapers, ...newPapers].sort(
    (a, b) => b.year - a.year || b.publication_date.localeCompare(a.publication_date)
  );

  fs.writeFileSync(papersPath, JSON.stringify(allPapers, null, 2), "utf-8");
  console.log(`Total papers saved: ${allPapers.length}`);

  // Stats
  const dbCounts: Record<string, number> = {};
  for (const p of allPapers) {
    for (const db of p.databases_used) {
      dbCounts[db] = (dbCounts[db] || 0) + 1;
    }
  }
  console.log("DB usage counts:", dbCounts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
