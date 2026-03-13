export interface RWDDatabase {
  slug: string;
  name: string;
  name_en: string;
  type: "public" | "commercial";
  administrator: string;
  data_types: string[];
  coverage: string;
  data_start: number;
  access: string;
  access_url?: string;
  publications_url?: string;
  strengths: string[];
  limitations: string[];
  linkable_with: string[];
  best_for: string[];
  related_resources?: { label: string; url: string }[];
}

export interface CommercialDBLink {
  company: string;
  description: string;
  url: string;
  pdf_url?: string;
}
