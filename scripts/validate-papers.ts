/**
 * data/papers.json を types/paper.ts のスキーマと突合して検証するスクリプト。
 * 週次Routineのセーフマージ・ガード（docs/routine-classify.md 手順7）から呼ぶ。
 *
 * 型崩れ（特に配列フィールドに単一の文字列が入る）を機械的に弾くのが主目的。
 * 2026-07-13 に additional_data_sources が文字列で書き込まれ、
 * 静的エクスポートが `.map is not a function` で落ち、本番デプロイが5週間停止した。
 *
 * 使用方法: npx tsx scripts/validate-papers.ts
 * 終了コード: 0 = 問題なし / 1 = 検証エラー（マージしてはいけない）
 */

import * as fs from "fs";
import * as path from "path";

type FieldType =
  | "string"
  | "string?"
  | "number"
  | "boolean"
  | "string[]"
  /** `YYYY-MM-DD` の実在する日付。並び替えの軸なので形が崩れると順序が壊れる */
  | "date"
  /** 省略可能かつ null も許す（OpenAlex から取れなかった場合に null が入る） */
  | "string|null?"
  | "number|null?"
  /** 省略可能かつ null も許す、{id, name, score} の配列 */
  | "topics|null?";

/** types/paper.ts の Paper インターフェースに対応。null許容フィールドは個別に扱う。 */
const SCHEMA: Record<string, FieldType> = {
  id: "string",
  pubmed_id: "string",
  title: "string",
  abstract: "string",
  journal: "string",
  entrez_date: "date",
  study_design: "string",
  entrez_year: "number",
  auto_detected: "boolean",
  collected_at: "string",
  classified: "boolean",
  authors: "string[]",
  databases_used: "string[]",
  additional_data_sources: "string[]",
  analysis_methods: "string[]",
  research_categories: "string[]",
  title_ja: "string?",
  abstract_ja: "string?",
  last_updated: "string?",
  openalex_topic: "string|null?",
  openalex_topic_score: "number|null?",
  openalex_topics: "topics|null?",
  openalex_subfield: "string|null?",
  openalex_field: "string|null?",
};

/**
 * 値が null でもよいが、キー自体は必ず存在しなければならないフィールド。
 *
 * openalex_* は型としては省略可能だが、収集スクリプトが取得できなかった場合も
 * null を書き込むので、収集を通った論文には必ず存在する。ここで存在を必須に
 * しておかないと、Routine がフィールドごと落としても検証をすり抜けて
 * 「診療分野が付かない論文」が黙って増えてしまう。
 */
/**
 * 分類の選択肢。docs/classification.md の表と一致させること。
 * databases_used は data/databases.json の paper_tag が正なので、ここでは見ない
 * （下のカンマ検査と、DBページ側の突き合わせで拾う）。
 */
const ENUMS: Record<string, Set<string>> = {
  study_design: new Set([
    "後方視的コホート研究",
    "横断的研究",
    "症例対照研究",
    "その他",
  ]),
  research_categories: new Set([
    "治療実態・処方パターン",
    "安全性・副作用",
    "治療効果・有効性",
    "疾病負荷・自然歴",
    "医療資源利用・経済評価",
    "医療の質・アクセスの格差",
    "方法論・バリデーション",
    "その他",
  ]),
  analysis_methods: new Set([
    "回帰分析",
    "生存時間分析",
    "傾向スコア (PSM/IPTW)",
    "不均衡分析（ROR/PRR等）",
    "中断時系列分析 (ITS)",
    "機械学習・AI",
    "メタアナリシス",
    "差分の差分法 (DID)",
    "ターゲットトライアルエミュレーション",
    "操作変数法",
    "自己対照ケースシリーズ (SCCS)",
  ]),
};

const NULLABLE = new Set([
  "doi",
  "journal_issn",
  "impact_factor",
  "sjr_quartile",
  "openalex_topic",
  "openalex_topic_score",
  "openalex_topics",
  "openalex_subfield",
  "openalex_field",
]);

function matches(value: unknown, type: FieldType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "string?":
      return value === undefined || typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string[]":
      return Array.isArray(value) && value.every((v) => typeof v === "string");
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      // 2026-02-30 のような実在しない日付を弾く。Date は繰り上げて黙って通すので
      // 往復させて一致を見る
      const d = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
    }
    case "string|null?":
      return value === undefined || value === null || typeof value === "string";
    case "number|null?":
      return (
        value === undefined ||
        value === null ||
        (typeof value === "number" && Number.isFinite(value))
      );
    case "topics|null?":
      return (
        value === undefined ||
        value === null ||
        (Array.isArray(value) &&
          value.every((v) => {
            if (typeof v !== "object" || v === null) return false;
            const t = v as { id?: unknown; name?: unknown; score?: unknown };
            return (
              // id は診療分野の辞書を引く鍵。欠けると分野が黙って付かなくなるので
              // 形もここで確かめる（`T` + 数字）
              typeof t.id === "string" &&
              /^T\d+$/.test(t.id) &&
              typeof t.name === "string" &&
              typeof t.score === "number" &&
              Number.isFinite(t.score)
            );
          }))
      );
  }
}

function main() {
  const file = path.join(process.cwd(), "data", "papers.json");
  const errors: string[] = [];

  let papers: Record<string, unknown>[];
  try {
    papers = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    console.error(`✗ data/papers.json をJSONとしてパースできない: ${(e as Error).message}`);
    process.exit(1);
  }

  if (!Array.isArray(papers)) {
    console.error("✗ data/papers.json のトップレベルが配列でない");
    process.exit(1);
  }

  const seen = new Map<string, number>();

  papers.forEach((paper, i) => {
    const label = typeof paper?.id === "string" ? paper.id : `index ${i}`;

    if (typeof paper !== "object" || paper === null) {
      errors.push(`${label}: 論文がオブジェクトでない`);
      return;
    }

    for (const [field, type] of Object.entries(SCHEMA)) {
      const value = paper[field];
      if (matches(value, type)) continue;
      const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
      errors.push(
        `${label}: ${field} は ${type} であるべきだが ${actual} (${JSON.stringify(value)?.slice(0, 60)})`
      );
    }

    for (const field of NULLABLE) {
      if (!(field in paper)) errors.push(`${label}: ${field} が存在しない`);
    }

    // スキーマに無いフィールドは弾く。型検査はスキーマに載っている項目しか見ないので、
    // これが無いと余計なフィールドが黙って通る。実際 mesh_terms を1件に足しても
    // 終了コード0で通っていた（2026-08-29 に確認）。
    // Routine(LLM) は過去のデータ形を覚えていて、廃止したフィールドを書き戻す
    // ことがありうる。復活に気づけるようにしておく。
    for (const field of Object.keys(paper)) {
      if (field in SCHEMA || NULLABLE.has(field)) continue;
      errors.push(
        `${label}: ${field} はスキーマに無いフィールド（廃止済みか綴り違い）`,
      );
    }

    if (typeof paper.id === "string") {
      const prev = seen.get(paper.id);
      if (prev !== undefined) errors.push(`${paper.id}: id が重複 (index ${prev} と ${i})`);
      else seen.set(paper.id, i);
    }

    // 絞り込み値にカンマが入るとURLで壊れる。
    // 複数選択は `?db=A&db=B` を使うが、古い `?db=A,B` 形式も読めるようにしてある
    // 都合で、値そのもののカンマが2つの条件に割れてしまう（該当0件になる）。
    //
    // databases_used を必ず含めること。`?db=` の絞り込み値を実際に供給しているのは
    // このフィールド（lib/papers-facets.ts の facetValuesOf）で、しかも Routine(LLM) が
    // 書き込む。databases.json の paper_tag 側のガードは、そこに載っていない
    // 新しいDB名を捕まえられない。
    for (const field of [
      "databases_used",
      "research_categories",
      "analysis_methods",
      "study_design",
    ]) {
      const value = paper[field];
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (typeof v === "string" && v.includes(",")) {
          errors.push(
            `${label}: ${field} の "${v}" にカンマが入っている（URLの区切りと衝突し、絞り込みが0件になる）`
          );
        }
      }
    }

    if (paper.classified !== true) {
      errors.push(`${label}: classified が true でない（未分類のままマージしてはいけない）`);
    }

    // 分類の値が docs/classification.md の選択肢に載っているか。
    // Routine(LLM) は表記を揺らすことがあり、実際に「ロジスティック回帰」
    // （正しくは「回帰分析」に含まれる）と「その他（薬剤に限定しない）」が
    // 混入していた。絞り込みに重複した選択肢として出てしまう。
    for (const [field, allowed] of Object.entries(ENUMS)) {
      const value = paper[field];
      for (const v of Array.isArray(value) ? value : [value]) {
        if (typeof v !== "string" || v === "" || allowed.has(v)) continue;
        errors.push(
          `${label}: ${field} の "${v}" は docs/classification.md の選択肢にない（表記ゆれ？）`,
        );
      }
    }
  });

  if (errors.length > 0) {
    console.error(`✗ ${papers.length}件を検証し、${errors.length}件の問題を検出:\n`);
    for (const e of errors.slice(0, 50)) console.error(`  - ${e}`);
    if (errors.length > 50) console.error(`  ... 他 ${errors.length - 50}件`);
    console.error("\nこの状態で main にマージするとサイトのビルドが落ちる。");
    process.exit(1);
  }

  console.log(`✓ ${papers.length}件すべてがスキーマに適合`);
}

main();
