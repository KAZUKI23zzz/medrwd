/**
 * OpenAlex から論文ごとのトピック（疾患・診療領域の軸）と、欠けているIFを補う。
 *
 * OpenAlex は 2026-02 に従量課金へ移行したが、singleton（/works/{id}、/sources/{id}）は
 * 課金対象外で残高が尽きていても200を返す。list形式（?filter=）は課金されるので使わない。
 * データは CC0。
 *
 *   npx tsx scripts/backfill-openalex.ts          # 未取得の論文だけ
 *   npx tsx scripts/backfill-openalex.ts --all    # 全件を取り直す
 */
import fs from "fs";
import path from "path";

type Topic = {
  display_name: string;
  score: number;
  subfield?: { display_name: string };
  field?: { display_name: string };
  domain?: { display_name: string };
};

type Paper = {
  pubmed_id: string;
  journal_issn: string | null;
  impact_factor: number | null;
  openalex_topic?: string | null;
  openalex_topic_score?: number | null;
  openalex_subfield?: string | null;
  openalex_field?: string | null;
  [key: string]: unknown;
};

const MAILTO = process.env.OPENALEX_MAILTO;
const params = MAILTO ? `&mailto=${encodeURIComponent(MAILTO)}` : "";
/** singleton は課金されないが、共有IPから叩くので礼儀として間隔を空ける */
const DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 404) return null; // OpenAlex に無い。想定内
    if (res.status === 429) {
      // singleton では起きないはずだが、起きたら理由を出して待つ
      console.warn(`  429 ${url} — ${(await res.text()).slice(0, 120)}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    console.warn(`  HTTP ${res.status} ${url}`);
    return null;
  }
  return null;
}

async function main() {
  const all = process.argv.includes("--all");
  const papersPath = path.join(process.cwd(), "data", "papers.json");
  const papers: Paper[] = JSON.parse(fs.readFileSync(papersPath, "utf-8"));

  const targets = papers.filter(
    (p) => all || p.openalex_topic === undefined || p.impact_factor == null,
  );
  console.log(`Papers: ${papers.length}, to fetch: ${targets.length}`);

  const issnCache = new Map<string, number | null>();
  let topicHit = 0;
  let topicMiss = 0;
  let ifFilled = 0;

  for (const [i, paper] of targets.entries()) {
    const work = (await getJson(
      `https://api.openalex.org/works/pmid:${paper.pubmed_id}?select=id,primary_topic${params}`,
    )) as { primary_topic?: Topic | null } | null;

    const topic = work?.primary_topic;
    if (topic?.display_name) {
      paper.openalex_topic = topic.display_name;
      paper.openalex_topic_score = Math.round(topic.score * 1000) / 1000;
      paper.openalex_subfield = topic.subfield?.display_name ?? null;
      paper.openalex_field = topic.field?.display_name ?? null;
      topicHit++;
    } else {
      // 取得できなかったことを null で記録する。undefined のままだと
      // 次回も取りに行ってしまう
      paper.openalex_topic = null;
      paper.openalex_topic_score = null;
      paper.openalex_subfield = null;
      paper.openalex_field = null;
      topicMiss++;
    }

    if (paper.impact_factor == null && paper.journal_issn) {
      const issn = paper.journal_issn;
      if (!issnCache.has(issn)) {
        await sleep(DELAY_MS);
        const source = (await getJson(
          `https://api.openalex.org/sources/issn:${issn}?${params.slice(1)}`,
        )) as { summary_stats?: { "2yr_mean_citedness"?: number } } | null;
        const value = source?.summary_stats?.["2yr_mean_citedness"];
        issnCache.set(issn, value ? Math.round(value * 100) / 100 : null);
      }
      const value = issnCache.get(issn) ?? null;
      if (value != null) {
        paper.impact_factor = value;
        ifFilled++;
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${targets.length} (topic ${topicHit}/${topicHit + topicMiss})`);
      fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2) + "\n");
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2) + "\n");
  console.log(`Done. topic ${topicHit} hit / ${topicMiss} miss, IF filled ${ifFilled}`);
}

main();
