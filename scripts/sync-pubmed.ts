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

import { fetchTopic, fetchImpactFactor } from "./openalex";
import { updateUnknownTopics } from "./unknown-topics";
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
  impact_factor: number | null;
  sjr_quartile: string | null;
  openalex_topic?: string | null;
  openalex_topic_score?: number | null;
  openalex_topics?: { id: string; name: string; score: number }[] | null;
  openalex_subfield?: string | null;
  openalex_field?: string | null;
  research_categories: string[];
  auto_detected: boolean;
  collected_at: string;
  classified: boolean;
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

/**
 * PubMed の1リクエストで返せるID数の上限（E-utilities の仕様）。
 * ここに達したら残りを取りこぼすので、黙って切らずに失敗させる。
 */
const ESEARCH_MAX = 10000;

/**
 * 検索窓。PubMed の登録日（Entrez Date）基準。
 *
 * 14日では足りない。検索条件に `hasabstract` を入れているので、登録時点で
 * アブストラクトが無い論文は当たらない。後から付いても登録日は変わらないため、
 * 窓が狭いとその論文は二度と拾えなくなる。実測では 14日→90日 で新規が
 * 15件→24件に増えた（差の9件が取りこぼしていた分）。
 */
const SEARCH_WINDOW_DAYS = 90;

/**
 * 1回の実行で新しく取り込む上限。あふれた分は翌週に回る。
 *
 * 分類はRoutine（LLM）がやるので、ここが実質的にLLMの作業量を決める。
 * 検索結果の件数を絞っても意味はない（あちらはIDだけで1件19バイト）。
 * 定常状態では週20件程度なので、通常は上限に当たらない。
 */
const MAX_NEW_PER_RUN = 50;

/** data/excluded-pmids.json の形 */
type ExcludedFile = { pmids: string[] };

/**
 * 条件に合う論文のPMIDを取る。**件数の上限は設けない。**
 *
 * 以前は `retmax=100` を決め打ちしていた。PubMed は新しい順に返すので、
 * 100件を超えると古い側が丸ごと捨てられる。しかも `count`（該当総数）を
 * 見ていなかったので、取りこぼしてもログにも `/status` にも出なかった。
 * 実測では直近90日で229件あり、100では129件を落としていた。
 *
 * 毎回同じ側が切られるため「翌週拾い直せる」も成り立たない。窓から出るまで
 * 一度も拾われずに失われる。
 */
async function searchPubMed(
  query: string,
  days: number = 30
): Promise<string[]> {
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&reldate=${days}&retmax=${ESEARCH_MAX}&retmode=json`;
  const data = (await pubmedFetchJSON(url)) as {
    esearchresult: { idlist: string[]; count: string };
  };
  const { idlist, count } = data.esearchresult;
  const total = Number(count);
  if (total > idlist.length) {
    throw new Error(
      `検索結果 ${total} 件のうち ${idlist.length} 件しか取得できていない` +
        `（上限 ${ESEARCH_MAX}）。取りこぼすので中断する。retstart でのページ送りが必要`
    );
  }
  return idlist;
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

  // MeSH は収集しない。PubMed の索引付けは公開から遅れるため、収集時点では
  // 半数にしか付かない。付いた後に取り直す処理も無いので、集めても永久に半分
  // のまま埋まらない。診療分野の辞書づくりには使い切ったので役目は終わり
  // （経緯は docs/related-papers.md）。MedlineCitation Status も同じ理由で不要。

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
// 取得処理は scripts/openalex.ts に集約してある（バックフィルと共通）。
// 以前はこのファイルとバックフィルに同じ処理が別々にあり、再試行・間隔・例外処理が
// 食い違っていた。

// --- Main ---
async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const papersPath = path.join(dataDir, "papers.json");

  // Load existing papers
  const existingPapers: Paper[] = JSON.parse(
    fs.readFileSync(papersPath, "utf-8")
  );
  const existingPmids = new Set(existingPapers.map((p) => p.pubmed_id));

  // 偽陽性として除いた論文。papers.json には残らないので、これが無いと
  // 検索窓に入っている間ずっと拾い直しては分類し、また消す、を繰り返す
  const excludedPath = path.join(process.cwd(), "data", "excluded-pmids.json");
  const excluded: Set<string> = new Set(
    (JSON.parse(fs.readFileSync(excludedPath, "utf-8")) as ExcludedFile).pmids
  );

  console.log(`Existing papers: ${existingPapers.length}, excluded: ${excluded.size}`);

  // Search PubMed for new papers (hasabstract で絞り込み済み)
  const allPmids = new Set<string>();
  for (const query of SEARCH_QUERIES) {
    const days = existingPapers.length === 0 ? 365 : SEARCH_WINDOW_DAYS;
    console.log(`Searching PubMed (last ${days} days, hasabstract)...`);
    const pmids = await searchPubMed(query, days);
    pmids.forEach((id) => allPmids.add(id));
  }
  console.log(`Search hits: ${allPmids.size}`);

  // 収集済みと除外済みを落とす
  const candidates = [...allPmids].filter(
    (id) => !existingPmids.has(id) && !excluded.has(id)
  );

  // 1回で処理する数を絞る。あふれた分は翌週に回る（収集済みを除外しているので
  // 二重にはならない）。**古い順**に採るのは、検索窓から先に外れるものを
  // 優先するため。新しい側は翌週も窓に残る。
  const newPmids = candidates
    .slice()
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, MAX_NEW_PER_RUN);
  const deferred = candidates.length - newPmids.length;
  console.log(
    `New PMIDs: ${newPmids.length}` +
      (deferred > 0 ? ` (${deferred} deferred to next run)` : "")
  );

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

    // 雑誌IF（OpenAlex）。取得失敗（undefined）は null 扱いで先に進む
    let impactFactor: number | null = null;
    if (article.journal_issn) {
      impactFactor = (await fetchImpactFactor(article.journal_issn)) ?? null;
    }

    // トピック（OpenAlex）。取得失敗なら全て null で入れておき、
    // 後から scripts/backfill-openalex.ts が拾い直す。
    // サイトの「診療分野」は、このトピックを data/topic-areas.json で引いて求める
    const topic = (await fetchTopic(article.pubmed_id)) ?? {
      openalex_topic: null,
      openalex_topic_score: null,
      openalex_subfield: null,
      openalex_field: null,
      openalex_topics: null,
    };

    // 分類・要約は Routine が後から埋める。ここでは空で出力し classified:false にする。
    const paper: Paper = {
      ...article,
      databases_used: [],
      additional_data_sources: [],
      study_design: "",
      analysis_methods: [],
      research_categories: [],
      impact_factor: impactFactor,
      sjr_quartile: null,
      ...topic,
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

  fs.writeFileSync(papersPath, JSON.stringify(allPapers, null, 2) + "\n", "utf-8");
  console.log(`Total papers saved: ${allPapers.length}`);

  // 辞書に無いトピックを記録する。新しいトピックが付いた論文は診療分野が
  // 付かないまま公開されるので、気づけるようにしておく（/status に出る）
  const issues = updateUnknownTopics(allPapers);
  console.log(
    `未登録トピック ${issues.unknown}種 / 改名 ${issues.renamed}種 → data/unknown-topics.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
