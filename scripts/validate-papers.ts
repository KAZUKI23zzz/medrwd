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
  /** 省略可能かつ null も許す（OpenAlex から取れなかった場合に null が入る） */
  | "string|null?"
  | "number|null?"
  /** 省略可能かつ null も許す、{name, score} の配列 */
  | "topics|null?";

/** types/paper.ts の Paper インターフェースに対応。null許容フィールドは個別に扱う。 */
const SCHEMA: Record<string, FieldType> = {
  id: "string",
  pubmed_id: "string",
  title: "string",
  abstract: "string",
  journal: "string",
  publication_date: "string",
  study_design: "string",
  year: "number",
  auto_detected: "boolean",
  collected_at: "string",
  classified: "boolean",
  authors: "string[]",
  databases_used: "string[]",
  additional_data_sources: "string[]",
  analysis_methods: "string[]",
  mesh_terms: "string[]",
  research_categories: "string[]",
  title_ja: "string?",
  abstract_ja: "string?",
  medline_status: "string?",
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
 * 「診療領域が無い論文」が黙って増えてしまう。
 */
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
          value.every(
            (v) =>
              typeof v === "object" &&
              v !== null &&
              typeof (v as { name?: unknown }).name === "string" &&
              typeof (v as { score?: unknown }).score === "number" &&
              Number.isFinite((v as { score: number }).score),
          ))
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
