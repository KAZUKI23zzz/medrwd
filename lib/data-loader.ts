import papersData from "@/data/papers.json";
import databasesData from "@/data/databases.json";
import privateLinksData from "@/data/private-db-links.json";
import syncStatusData from "@/data/sync-status.json";
import unknownTopicsData from "@/data/unknown-topics.json";
import type { Paper } from "@/types/paper";
import { DATABASE_TYPE_LABEL } from "@/types/database";
import type { RWDDatabase, PrivateDBLink } from "@/types/database";
import type { SyncStatus } from "@/types/sync-status";
import type { UnknownTopicsFile } from "@/types/unknown-topics";

/**
 * 配列であるべきフィールド。Routine(LLM)が単一文字列を書き込むと
 * `.map is not a function` で静的エクスポートごと落ちるため、読み込み時に正規化する。
 */
const ARRAY_FIELDS = [
  "authors",
  "databases_used",
  "additional_data_sources",
  "analysis_methods",
  "mesh_terms",
  "research_categories",
] as const;

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  return [];
}

const papers: Paper[] = (papersData as unknown as Paper[]).map((paper) => {
  const needsFix = ARRAY_FIELDS.some((f) => !Array.isArray(paper[f]));
  if (!needsFix) return paper;
  const fixed = { ...paper };
  for (const f of ARRAY_FIELDS) fixed[f] = toStringArray(paper[f]);
  return fixed;
});

export function getPapers(): Paper[] {
  return papers;
}

export function getDatabases(): RWDDatabase[] {
  const databases = databasesData as RWDDatabase[];
  // 区分の表記は DATABASE_TYPE_LABEL 等の表から引いており、想定外の値が入ると
  // バッジが黙って空欄になる。JSON は as でキャストしているだけで型検査が効かないので、
  // ビルド時にここで気づけるようにしておく。
  for (const db of databases) {
    if (!(db.type in DATABASE_TYPE_LABEL)) {
      throw new Error(
        `databases.json: ${db.slug} の type "${db.type}" は未知の区分です（public / private のいずれか）`,
      );
    }
    // 古い形式のURL（?db=A,B）を読めるようにしてある都合で、絞り込み値に
    // カンマが入ると2つの値に割れてしまう。混入したらここで気づけるようにする。
    if (db.paper_tag.includes(",")) {
      throw new Error(
        `databases.json: ${db.slug} の paper_tag "${db.paper_tag}" にカンマは使えません（URLの区切りと衝突します）`,
      );
    }
  }
  return databases;
}

export function getPrivateDbLinks(): PrivateDBLink[] {
  return privateLinksData as PrivateDBLink[];
}

export function getSyncStatus(): SyncStatus {
  return syncStatusData as SyncStatus;
}


/**
 * 辞書に無い（または改名された）OpenAlex トピック。
 * 収集のたびに scripts/unknown-topics.ts が作り直す。/status で見せる。
 */
export function getUnknownTopics(): UnknownTopicsFile {
  return unknownTopicsData as UnknownTopicsFile;
}
