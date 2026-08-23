/**
 * OpenAlex から論文ごとの診療領域と、欠けているIFを補う。
 * 取得処理は scripts/openalex.ts に集約してある（収集スクリプトと共通）。
 *
 *   npx tsx scripts/backfill-openalex.ts          # 未取得・欠損のある論文だけ
 *   npx tsx scripts/backfill-openalex.ts --all    # 全件を取り直す
 *
 * 冪等。取得に失敗した論文は既存の値を残してスキップするので、
 * 再実行しても持っているデータを壊さない。
 */
import fs from "fs";
import path from "path";
import { fetchTopic, fetchImpactFactor } from "./openalex";

type Paper = {
  pubmed_id: string;
  journal_issn: string | null;
  impact_factor: number | null;
  openalex_topic?: string | null;
  [key: string]: unknown;
};

async function main() {
  const all = process.argv.includes("--all");
  const papersPath = path.join(process.cwd(), "data", "papers.json");
  const papers: Paper[] = JSON.parse(fs.readFileSync(papersPath, "utf-8"));

  // null も対象にする。収集時に OpenAlex がまだその論文を収載しておらず
  // 404 になった場合、null のまま二度と取りに行かないと永久に欠けてしまう。
  const targets = papers.filter(
    (p) => all || p.openalex_topic == null || p.impact_factor == null,
  );
  console.log(`Papers: ${papers.length}, to fetch: ${targets.length}`);

  const save = () =>
    fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2) + "\n");

  let topicHit = 0;
  let topicEmpty = 0;
  let topicFailed = 0;
  let ifFilled = 0;

  for (const [i, paper] of targets.entries()) {
    const topic = await fetchTopic(paper.pubmed_id);
    if (topic === null) {
      // 取得失敗。既存の値を null で塗り潰さないこと（過去にこれでデータを壊した）
      topicFailed++;
    } else {
      Object.assign(paper, topic);
      if (topic.openalex_topic) topicHit++;
      else topicEmpty++;
    }

    if (paper.impact_factor == null && paper.journal_issn) {
      const value = await fetchImpactFactor(paper.journal_issn);
      // undefined は取得失敗。null は「OpenAlex に値が無い」なので確定させてよい
      if (value !== undefined) {
        paper.impact_factor = value;
        if (value != null) ifFilled++;
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(
        `  ${i + 1}/${targets.length} (topic ${topicHit} hit / ${topicEmpty} empty / ${topicFailed} failed)`,
      );
      save();
    }
  }

  save();
  console.log(
    `Done. topic ${topicHit} hit / ${topicEmpty} empty / ${topicFailed} failed, IF filled ${ifFilled}`,
  );
  if (topicFailed > 0) {
    console.log("失敗した論文は値を変更していない。再実行すれば拾い直せる。");
  }
}

main().catch((e) => {
  console.error("backfill-openalex に失敗:", e);
  process.exit(1);
});
