/**
 * OpenAlex の公開スナップショットと `data/topic-areas.json` を突き合わせる。
 *
 * OpenAlex はトピックを新設・改名・統廃合する。辞書は全4,516トピックを
 * 収録しているが、これはある時点のスナップショットなので、いずれずれる。
 * ずれを見つけるための道具。
 *
 * **API の list エンドポイント（`?filter=` / `/topics`）は課金対象なので使わない。**
 * 公開スナップショット（S3、認証不要・無料）から取る。
 *
 * 使用方法:
 *   npx tsx scripts/sync-topic-areas.ts              # 差分を報告するだけ
 *   npx tsx scripts/sync-topic-areas.ts --write-renames  # 改名だけ辞書に反映する
 *
 * 新しいトピックは自動で追加しない。`areas: []` で入れてしまうと
 * 「レビュー済みで分野なし」と区別できなくなり、人の目に触れないまま
 * 埋もれるため。報告を見て手で追記すること。
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";

const MANIFEST =
  "https://openalex.s3.amazonaws.com/data/jsonl/topics/manifest.json";
const DICT = path.join(process.cwd(), "data", "topic-areas.json");

type Dict = {
  _readme: string[];
  snapshot_date: string;
  areas: string[];
  topics: Record<string, { name: string; areas: string[] }>;
};

type Manifest = {
  date: string;
  record_count: number;
  files: { url: string }[];
};

async function fetchSnapshot(): Promise<{
  date: string;
  topics: Map<string, string>;
}> {
  const manifest: Manifest = await (await fetch(MANIFEST)).json();
  const topics = new Map<string, string>();
  for (const file of manifest.files) {
    const url = file.url.replace(
      "s3://openalex/",
      "https://openalex.s3.amazonaws.com/",
    );
    const gz = Buffer.from(await (await fetch(url)).arrayBuffer());
    const text = zlib.gunzipSync(gz).toString("utf-8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as { id: string; display_name: string };
      topics.set(record.id.replace(/^.*\//, ""), record.display_name);
    }
  }
  return { date: manifest.date, topics };
}

async function main() {
  const write = process.argv.includes("--write-renames");
  const dict: Dict = JSON.parse(fs.readFileSync(DICT, "utf-8"));
  console.log(
    `辞書: ${Object.keys(dict.topics).length}トピック（スナップショット ${dict.snapshot_date} 版）`,
  );

  const snap = await fetchSnapshot();
  console.log(`OpenAlex: ${snap.topics.size}トピック（${snap.date} 版）`);
  if (snap.date === dict.snapshot_date) {
    console.log("スナップショットの日付が同じ。差分は無いはず。");
  }

  const added: string[] = [];
  const renamed: { id: string; from: string; to: string }[] = [];
  for (const [id, name] of snap.topics) {
    const entry = dict.topics[id];
    if (!entry) added.push(id);
    else if (entry.name !== name)
      renamed.push({ id, from: entry.name, to: name });
  }
  // 消えたトピックは辞書に残す。過去の論文がまだそのIDを持っているため
  const removed = Object.keys(dict.topics).filter((id) => !snap.topics.has(id));

  console.log(`\n新設 ${added.length} / 改名 ${renamed.length} / 消滅 ${removed.length}`);

  if (added.length > 0) {
    console.log("\n■ 新設（辞書に手で追記すること。診療分野に落ちないなら [] で入れる）");
    for (const id of added) console.log(`  "${id}": { "name": "${snap.topics.get(id)}", "areas": [] },`);
  }
  if (renamed.length > 0) {
    console.log("\n■ 改名（診療分野はIDで引いているので影響なし。名前だけ直す）");
    for (const r of renamed) console.log(`  ${r.id}  ${r.from}\n            → ${r.to}`);
  }
  if (removed.length > 0) {
    console.log("\n■ 消滅（辞書からは消さない。過去の論文がまだこのIDを持っている）");
    for (const id of removed) console.log(`  ${id}  ${dict.topics[id].name}`);
  }

  if (write && renamed.length > 0) {
    for (const r of renamed) dict.topics[r.id].name = r.to;
    dict.snapshot_date = snap.date;
    fs.writeFileSync(DICT, JSON.stringify(dict, null, 2) + "\n");
    console.log(`\n改名 ${renamed.length}件を反映し、snapshot_date を ${snap.date} にした。`);
    if (added.length > 0)
      console.log("新設分は書いていない。上の行を辞書に貼って分野を決めること。");
  } else if (renamed.length > 0) {
    console.log("\n--write-renames を付けると改名だけ反映する。");
  }
}

main().catch((e) => {
  console.error("sync-topic-areas に失敗:", e);
  process.exit(1);
});
