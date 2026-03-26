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
  analysis_methods: string[];
  mesh_terms: string[];
  impact_factor: number | null;
  sjr_quartile: string | null;
  research_categories: string[];
  auto_detected: boolean;
  collected_at: string;
  medline_status?: string;
  last_updated?: string;
}

// --- DB Detection (inline to avoid TS module issues in scripts) ---
interface KeywordEntry {
  patterns: string[];
  display: string;
}

interface KeywordsData {
  databases: (KeywordEntry & { id: string })[];
  additional_sources: KeywordEntry[];
  analysis_methods: KeywordEntry[];
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
  '((Japan[MeSH] OR Japan[TIAB] OR Japanese[TIAB]) AND ("claims-based"[TIAB] OR "claims based"[TIAB] OR "claims database"[TIAB] OR "claims databases"[TIAB] OR "administrative database"[TIAB] OR "administrative databases"[TIAB] OR "healthcare database"[TIAB] OR "healthcare databases"[TIAB] OR "insurance database"[TIAB] OR "insurance databases"[TIAB] OR "electronic medical record database"[TIAB] OR "electronic medical record databases"[TIAB] OR "electronic health record database"[TIAB] OR "electronic health record databases"[TIAB] OR "routinely collected health data"[MeSH] OR "target trial emulation"[TIAB] OR "JMDC"[TIAB] OR "Japan Medical Data Center"[TIAB] OR "DPC"[TIAB] OR "Diagnosis Procedure Combination"[TIAB] OR "NDB"[TIAB] OR "National Database of Health Insurance Claims"[TIAB] OR "MDV"[TIAB] OR "Medical Data Vision"[TIAB] OR "NCD"[TIAB] OR "National Clinical Database"[TIAB] OR "MID-NET"[TIAB] OR "JADER"[TIAB] OR "Japanese Adverse Drug Event Report database"[TIAB])) NOT ("Clinical Trial"[PT] OR "review"[PT] OR "Meta-Analysis"[PT] OR "randomized controlled trial"[PT])',
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

function parseArticleXML(articleXml: string): Omit<Paper, "impact_factor" | "sjr_quartile" | "databases_used" | "additional_data_sources" | "study_design" | "research_categories" | "auto_detected" | "collected_at" | "last_updated"> | null {
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

async function fetchPubMedArticles(pmids: string[]): Promise<ReturnType<typeof parseArticleXML>[]> {
  if (pmids.length === 0) return [];

  // Batch in groups of 50
  const results: ReturnType<typeof parseArticleXML>[] = [];
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

  // --- Re-fetch incomplete papers (medline_status not final) ---
  const now = new Date();
  const DAYS_180_MS = 180 * 24 * 60 * 60 * 1000;
  const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
  let dataChanged = false;

  const incompletePapers = existingPapers.filter((p) => {
    // Already finalized
    if (p.medline_status === "MEDLINE" || p.medline_status === "PubMed-not-MEDLINE") return false;
    // Too old — give up
    const collectedAt = new Date(p.collected_at).getTime();
    if (now.getTime() - collectedAt > DAYS_180_MS) return false;
    // Recently re-fetched — skip
    if (p.last_updated) {
      const lastUpdated = new Date(p.last_updated).getTime();
      if (now.getTime() - lastUpdated < DAYS_30_MS) return false;
    }
    return true;
  });

  if (incompletePapers.length > 0) {
    console.log(`Re-fetching ${incompletePapers.length} incomplete papers...`);
    const incompletePmids = incompletePapers.map((p) => p.pubmed_id);
    const refetched = await fetchPubMedArticles(incompletePmids);

    for (const article of refetched) {
      if (!article) continue;
      const idx = existingPapers.findIndex((p) => p.pubmed_id === article.pubmed_id);
      if (idx === -1) continue;

      const existing = existingPapers[idx];
      const oldStatus = existing.medline_status;
      const hadAbstract = existing.abstract.trim().length > 0;
      const hadMesh = existing.mesh_terms.length > 0;

      // Update status
      existing.medline_status = article.medline_status;
      existing.last_updated = now.toISOString();

      // Check if abstract or MeSH were added
      const abstractAdded = !hadAbstract && article.abstract.trim().length > 0;
      const meshAdded = !hadMesh && article.mesh_terms.length > 0;

      if (abstractAdded || meshAdded) {
        dataChanged = true;

        if (abstractAdded) {
          existing.abstract = article.abstract;
          existing.mesh_terms = article.mesh_terms;
          console.log(`  PMID ${article.pubmed_id}: abstract added [${oldStatus} → ${article.medline_status}]`);

          // Translate abstract
          try {
            existing.abstract_ja = await translateText(article.abstract);
            await new Promise((r) => setTimeout(r, 300));
          } catch (e) {
            console.warn(`  Translation failed for ${article.pubmed_id}:`, e);
          }
        } else if (meshAdded) {
          existing.mesh_terms = article.mesh_terms;
          console.log(`  PMID ${article.pubmed_id}: MeSH terms added [${oldStatus} → ${article.medline_status}]`);
        }

        // Re-run detection with updated text
        const detectText = `${existing.title} ${existing.abstract} ${existing.mesh_terms.join(" ")}`;
        existing.databases_used = matchPatterns(detectText, keywords.databases);
        existing.additional_data_sources = matchPatterns(detectText, keywords.additional_sources);
        existing.study_design = matchPatterns(detectText, keywords.study_designs)[0] || "その他";
        existing.analysis_methods = matchPatterns(detectText, keywords.analysis_methods);

        // Re-score categories
        const categoryScores: { display: string; score: number }[] = [];
        for (const cat of keywords.research_categories) {
          const score = countPatternMatches(detectText, cat.patterns);
          if (score > 0) categoryScores.push({ display: cat.display, score });
        }
        categoryScores.sort((a, b) => b.score - a.score);
        existing.research_categories =
          categoryScores.length > 0 ? categoryScores.slice(0, 2).map((c) => c.display) : ["その他"];
      } else {
        // Status may have changed even without new data
        if (oldStatus !== article.medline_status) {
          dataChanged = true;
          console.log(`  PMID ${article.pubmed_id}: status updated [${oldStatus} → ${article.medline_status}]`);
        } else {
          console.log(`  PMID ${article.pubmed_id}: no changes [${article.medline_status}]`);
        }
      }
    }
  }
  // --- End re-fetch ---

  // Search PubMed for new papers
  const allPmids = new Set<string>();
  for (const query of SEARCH_QUERIES) {
    const days = existingPapers.length === 0 ? 365 : 14;
    console.log(`Searching PubMed (last ${days} days)...`);
    const pmids = await searchPubMed(query, days);
    pmids.forEach((id) => allPmids.add(id));
  }

  // Filter out already collected
  const newPmids = [...allPmids].filter((id) => !existingPmids.has(id));
  console.log(`New PMIDs found: ${newPmids.length}`);

  // Process new papers
  const newPapers: Paper[] = [];
  if (newPmids.length > 0) {
    console.log("Fetching article metadata...");
    const articles = await fetchPubMedArticles(newPmids);

    for (const article of articles) {
      if (!article) continue;

      const hasAbstract = article.abstract.trim().length > 0;

      // Detection: only run if abstract is available
      let detection = {
        databases_used: [] as string[],
        additional_data_sources: [] as string[],
        study_design: "その他",
        analysis_methods: [] as string[],
      };
      let research_categories = ["その他"];

      if (hasAbstract) {
        const detectText = `${article.title} ${article.abstract} ${article.mesh_terms.join(" ")}`;
        detection = {
          databases_used: matchPatterns(detectText, keywords.databases),
          additional_data_sources: matchPatterns(detectText, keywords.additional_sources),
          study_design: matchPatterns(detectText, keywords.study_designs)[0] || "その他",
          analysis_methods: matchPatterns(detectText, keywords.analysis_methods),
        };

        const categoryScores: { display: string; score: number }[] = [];
        for (const cat of keywords.research_categories) {
          const score = countPatternMatches(detectText, cat.patterns);
          if (score > 0) {
            categoryScores.push({ display: cat.display, score });
          }
        }
        categoryScores.sort((a, b) => b.score - a.score);
        research_categories =
          categoryScores.length > 0
            ? categoryScores.slice(0, 2).map((c) => c.display)
            : ["その他"];
      }

      // Get journal metrics from OpenAlex
      let metrics = { impact_factor: null as number | null, sjr_quartile: null as string | null };
      if (article.journal_issn) {
        metrics = await getJournalMetrics(article.journal_issn);
      }

      // Translate: title always, abstract only if available
      let title_ja: string | undefined;
      let abstract_ja: string | undefined;
      try {
        title_ja = await translateText(article.title);
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.warn(`Title translation failed for ${article.id}:`, e);
      }
      if (hasAbstract) {
        try {
          abstract_ja = await translateText(article.abstract);
          await new Promise((r) => setTimeout(r, 300));
        } catch (e) {
          console.warn(`Abstract translation failed for ${article.id}:`, e);
        }
      }

      const paper: Paper = {
        ...article,
        title_ja,
        abstract_ja,
        databases_used: detection.databases_used,
        additional_data_sources: detection.additional_data_sources,
        study_design: detection.study_design,
        analysis_methods: detection.analysis_methods,
        research_categories,
        impact_factor: metrics.impact_factor,
        sjr_quartile: metrics.sjr_quartile,
        auto_detected: true,
        collected_at: new Date().toISOString(),
      };

      newPapers.push(paper);
    }

    console.log(`Processed ${newPapers.length} new papers`);
  } else {
    console.log("No new papers found.");
  }

  // Save if there are new papers or existing data was updated
  if (newPapers.length === 0 && !dataChanged) {
    console.log("No changes to save. Exiting.");
    return;
  }

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
