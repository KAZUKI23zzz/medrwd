import papersData from "@/data/papers.json";
import databasesData from "@/data/databases.json";
import newsData from "@/data/news.json";
import commercialLinksData from "@/data/commercial-db-links.json";
import type { Paper } from "@/types/paper";
import type { RWDDatabase, CommercialDBLink } from "@/types/database";
import type { NewsItem } from "@/types/news";

export function getPapers(): Paper[] {
  return papersData as Paper[];
}

export function getDatabases(): RWDDatabase[] {
  return databasesData as RWDDatabase[];
}

export function getNews(): NewsItem[] {
  return newsData as NewsItem[];
}

export function getCommercialLinks(): CommercialDBLink[] {
  return commercialLinksData as CommercialDBLink[];
}
