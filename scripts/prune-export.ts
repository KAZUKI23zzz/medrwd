/**
 * 静的エクスポート（`out/`）から、誰も読まない `__next._full.txt` を消すスクリプト。
 * `npm run build` の後段で走る（package.json の build スクリプト）。
 *
 * ## なぜ必要か
 *
 * 2026-09-06、Vercel から Deployment Storage（無料枠10GB）を使い切ったという
 * 警告が来た。この枠は**1デプロイの大きさ×保持しているデプロイ数**で、
 * 1デプロイ198MB・保持期間30日・8月は33コミット（各コミットにプレビューと
 * 本番の2デプロイ）で埋まっていた。
 *
 * Next.js 16 は静的エクスポートでも、ルート1本につきセグメントプリフェッチ用の
 * ファイルを7本吐く（`papers/<id>/__next.*.txt`）。合計66.7MB・7,840ファイルで、
 * `out/` の実測 170MB / 10,126ファイルの39%・78%を占める。
 *
 * そのうち `__next._full.txt` は**ページ全体のRSCペイロードの複製**で、
 * 隣にある `papers/<id>.txt` と1バイトも違わない（実測1,121本すべて一致）。
 * 読みに来るのは `cacheComponents`（PPRのレジューム）を有効にしたときに
 * HTMLへ差し込まれる `__NEXT_CLIENT_RESUME` のフェッチだけで、
 * このサイトは `cacheComponents` を使っていないので誰も読まない
 * （実際にブラウザで全ページの通信を見て、要求が0件であることを確認した）。
 *
 * 消すと1デプロイあたり33.1MB（-19%）・1,121ファイル（-11%）減る。
 * 表示・遷移・プリフェッチの挙動は変わらない。
 *
 * ## 消さないもの
 *
 * `__next._tree.txt` / `__next._head.txt` / `__next._index.txt` /
 * `__next.<segment>.__PAGE__.txt` はブラウザが実際に要求する。消すと404になり、
 * 遷移自体は成り立つ（フルのRSCペイロードへ落ちる）が、1ページにつき7本の
 * 404が出る。残り33.6MBのためにそれを引き受ける価値は今はないと判断した。
 * 判断の根拠と実測値は docs/backlog.md の S1 を参照。
 *
 * ## 安全側の作り
 *
 * このスクリプトは最適化にすぎないので、**何があってもビルドを落とさない**。
 * 判断がつかないものは消さずに警告だけ出す。
 *  - `__NEXT_CLIENT_RESUME` がHTMLに1つでもあれば、`_full` は読まれている
 *    （= cacheComponents が有効になった）ので、何も消さずに終わる。
 *  - 隣の `.txt` が無い／中身が違うファイルは消さない。
 *
 * 使用方法: npx tsx scripts/prune-export.ts
 */

import * as fs from "fs";
import * as path from "path";

const OUT_DIR = path.join(process.cwd(), "out");
/** Next.js が書くページ全体のRSCペイロードの複製。隣の `<route>.txt` と同一 */
const FULL_SEGMENT = "__next._full.txt";
/** cacheComponents 有効時にHTMLへ差し込まれる、`/_full` を取りに行くスクリプト */
const RESUME_MARKER = "__NEXT_CLIENT_RESUME";

/** `out/` 以下のファイルを再帰的に列挙する */
function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/**
 * `out/papers/pmid-x/__next._full.txt` に対する `out/papers/pmid-x.txt`。
 * ルート直下（`out/__next._full.txt`）だけは `out/index.txt` が相方になる。
 */
function siblingPayloadOf(fullPath: string): string {
  const dir = path.dirname(fullPath);
  if (dir === OUT_DIR) return path.join(OUT_DIR, "index.txt");
  return `${dir}.txt`;
}

function main(): void {
  if (!fs.existsSync(OUT_DIR)) {
    console.warn("prune-export: out/ が無いので何もしない");
    return;
  }

  const files = walk(OUT_DIR);
  const html = files.filter((f) => f.endsWith(".html"));
  const fulls = files.filter((f) => path.basename(f) === FULL_SEGMENT);

  if (fulls.length === 0) {
    console.log("prune-export: 対象なし");
    return;
  }

  // cacheComponents を有効にすると `_full` は実際に読まれる。1本でも見つけたら降りる
  const resumed = html.find((f) => fs.readFileSync(f, "utf8").includes(RESUME_MARKER));
  if (resumed) {
    console.warn(
      `prune-export: ${path.relative(OUT_DIR, resumed)} に ${RESUME_MARKER} がある。` +
        `_full は読まれているので削除しない（cacheComponents が有効になった？）`,
    );
    return;
  }

  let removed = 0;
  let bytes = 0;
  const kept: string[] = [];
  for (const full of fulls) {
    const sibling = siblingPayloadOf(full);
    if (!fs.existsSync(sibling)) {
      kept.push(`${path.relative(OUT_DIR, full)}: 相方の .txt が無い`);
      continue;
    }
    if (!fs.readFileSync(full).equals(fs.readFileSync(sibling))) {
      kept.push(`${path.relative(OUT_DIR, full)}: 相方の .txt と中身が違う`);
      continue;
    }
    bytes += fs.statSync(full).size;
    fs.unlinkSync(full);
    removed++;
  }

  // 空になったセグメントのディレクトリは残さない（Vercelのファイル数にも効く）
  for (const dir of new Set(fulls.map((f) => path.dirname(f)))) {
    if (dir !== OUT_DIR && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }

  console.log(
    `prune-export: ${FULL_SEGMENT} を ${removed} 本削除` +
      `（${(bytes / 1024 / 1024).toFixed(1)} MB）`,
  );
  if (kept.length > 0) {
    console.warn(`prune-export: ${kept.length} 本は判断がつかないので残した`);
    for (const line of kept.slice(0, 10)) console.warn(`  - ${line}`);
  }
}

main();
