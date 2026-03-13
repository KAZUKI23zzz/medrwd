/**
 * fetch-rss.ts
 * RSS feeds from PMDA, MHLW, and medRxiv → news.json
 *
 * Usage: npx tsx scripts/fetch-rss.ts
 */

import * as fs from "fs";
import * as path from "path";

interface NewsItem {
  id: string;
  source: "PMDA" | "MHLW" | "medRxiv";
  title: string;
  url: string;
  published_at: string;
  collected_at: string;
}

const RSS_FEEDS: {
  source: NewsItem["source"];
  url: string;
  idPrefix: string;
}[] = [
  {
    source: "PMDA",
    url: "https://www.pmda.go.jp/rss_001.xml",
    idPrefix: "pmda",
  },
  {
    source: "MHLW",
    url: "https://www.mhlw.go.jp/stf/news.rdf",
    idPrefix: "mhlw",
  },
  {
    source: "medRxiv",
    url: "https://connect.medrxiv.org/medrxiv_xml.php?subject=Health+Policy",
    idPrefix: "medrxiv",
  },
];

// Simple XML tag extraction (no external deps)
function extractTags(xml: string, tagName: string): string[] {
  const regex = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`,
    "gi"
  );
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`,
    "i"
  );
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
}

function extractAttr(xml: string, tagName: string, attr: string): string {
  const regex = new RegExp(`<${tagName}[^>]*${attr}="([^"]*)"`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
}

function stripCDATA(str: string): string {
  return str
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .trim();
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // Fall through
  }
  return new Date().toISOString();
}

async function fetchRSS(
  feedUrl: string,
  source: NewsItem["source"],
  idPrefix: string
): Promise<NewsItem[]> {
  console.log(`Fetching ${source}: ${feedUrl}`);
  const items: NewsItem[] = [];
  const now = new Date().toISOString();

  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "MedRWD-Japan-Bot/1.0 (RSS Reader)",
      },
    });
    if (!res.ok) {
      console.error(`  HTTP ${res.status} for ${source}`);
      return [];
    }
    const xml = await res.text();

    // Try RSS 2.0 items first
    let itemBlocks = extractTags(xml, "item");

    if (itemBlocks.length === 0) {
      // Try Atom entries
      itemBlocks = extractTags(xml, "entry");
    }

    console.log(`  Found ${itemBlocks.length} items`);

    for (const block of itemBlocks) {
      let title = stripCDATA(extractTag(block, "title"));
      title = decodeEntities(title);

      // Get URL: <link> text, or <link href="..."/>
      let url = stripCDATA(extractTag(block, "link"));
      if (!url) {
        url = extractAttr(block, "link", "href");
      }

      // Get date
      let dateStr =
        extractTag(block, "pubDate") ||
        extractTag(block, "dc:date") ||
        extractTag(block, "published") ||
        extractTag(block, "updated") ||
        "";

      if (!title || !url) continue;

      // Create a stable ID from URL + title using a simple hash
      const hashInput = url + title;
      let hash = 0;
      for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
      }
      const id = `${idPrefix}-${(hash >>> 0).toString(36)}`;

      items.push({
        id,
        source,
        title,
        url,
        published_at: parseDate(dateStr),
        collected_at: now,
      });
    }
  } catch (err) {
    console.error(`  Error fetching ${source}:`, err);
  }

  return items;
}

/**
 * RWD関連のキーワードフィルタ
 * タイトルにこれらのキーワードが含まれる記事のみ取り込む
 */
const RWD_KEYWORDS = [
  // データベース名
  /\bNDB\b/,
  /\bDPC\b/,
  /\bJMDC\b/,
  /\bMDV\b/,
  /MID-NET/,
  /\bJADER\b/,
  /SS-MIX/,
  /\bKDB\b/,
  // RWD関連の日本語キーワード
  /レセプト/,
  /リアルワールド/,
  /医療データ/,
  /医療情報/,
  /電子カルテ/,
  /二次利用/,
  /二次活用/,
  /データベース.*医療/,
  /医療.*データベース/,
  /副作用/,
  /有害事象/,
  /安全性情報/,
  /疫学/,
  /薬剤疫学/,
  /特定健診/,
  /介護データ/,
  /介護DB/,
  /がん登録/,
  /オープンデータ.*医療/,
  /医療.*オープンデータ/,
  /診療報酬.*改定/,
  /医薬品.*安全/,
  /安全対策.*医薬/,
  /市販後/,
  /ファーマコビジランス/,
  /健康保険.*データ/,
  /保健医療.*情報/,
  /医療DX/,
  /全国がん/,
  /患者調査/,
  /国民生活基礎調査/,
  /人口動態/,
  /医療施設調査/,
  /社会医療診療行為/,
  // RWD関連の英語キーワード
  /real.?world/i,
  /\bRWD\b/i,
  /claims.?data/i,
  /pharmacoepidem/i,
  /drug.?safety/i,
  /adverse.?event/i,
  /pharmacovigilance/i,
  /national database/i,
  /electronic.?health.?record/i,
  /\bEHR\b/,
  /\bEMR\b/,
];

function filterByRWDRelevance(items: NewsItem[]): NewsItem[] {
  return items.filter((item) =>
    RWD_KEYWORDS.some((kw) => kw.test(item.title))
  );
}

async function main() {
  const dataPath = path.join(process.cwd(), "data", "news.json");

  // Load existing
  let existing: NewsItem[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch {
    existing = [];
  }

  const existingIds = new Set(existing.map((n) => n.id));
  console.log(`Existing news items: ${existing.length}`);

  let newItems: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    const items = await fetchRSS(feed.url, feed.source, feed.idPrefix);

    // PMDA is always RWD-relevant; MHLW and medRxiv need keyword filtering
    const filtered =
      feed.source === "PMDA" ? items : filterByRWDRelevance(items);

    // Only add new items
    const fresh = filtered.filter((item) => !existingIds.has(item.id));
    console.log(
      `  ${feed.source}: ${fresh.length} new (${filtered.length} total, ${items.length} raw)`
    );
    newItems = newItems.concat(fresh);
  }

  if (newItems.length === 0) {
    console.log("No new items found");
    return;
  }

  // Combine and sort by date desc
  const all = [...newItems, ...existing].sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  // Keep last 500 items max
  const trimmed = all.slice(0, 500);

  fs.writeFileSync(dataPath, JSON.stringify(trimmed, null, 2));
  console.log(`\nTotal news items saved: ${trimmed.length}`);
  console.log("New items added:", newItems.length);
}

main().catch(console.error);
