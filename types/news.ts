export interface NewsItem {
  id: string;
  source: "PMDA" | "MHLW" | "medRxiv";
  title: string;
  url: string;
  published_at: string;
  collected_at: string;
}
