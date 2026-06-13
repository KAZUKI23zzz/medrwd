import papersData from "@/data/papers.json";
import databasesData from "@/data/databases.json";
import commercialLinksData from "@/data/commercial-db-links.json";
import syncStatusData from "@/data/sync-status.json";
import type { Paper } from "@/types/paper";
import type { RWDDatabase, CommercialDBLink } from "@/types/database";
import type { SyncStatus } from "@/types/sync-status";

export function getPapers(): Paper[] {
  return papersData as Paper[];
}

export function getDatabases(): RWDDatabase[] {
  return databasesData as RWDDatabase[];
}

export function getCommercialLinks(): CommercialDBLink[] {
  return commercialLinksData as CommercialDBLink[];
}

export function getSyncStatus(): SyncStatus {
  return syncStatusData as SyncStatus;
}
