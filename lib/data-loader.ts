import papersData from "@/data/papers.json";
import databasesData from "@/data/databases.json";
import privateLinksData from "@/data/private-db-links.json";
import syncStatusData from "@/data/sync-status.json";
import type { Paper } from "@/types/paper";
import type { RWDDatabase, PrivateDBLink } from "@/types/database";
import type { SyncStatus } from "@/types/sync-status";

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
  return databasesData as RWDDatabase[];
}

export function getPrivateDbLinks(): PrivateDBLink[] {
  return privateLinksData as PrivateDBLink[];
}

export function getSyncStatus(): SyncStatus {
  return syncStatusData as SyncStatus;
}
