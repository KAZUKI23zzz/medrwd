export interface Paper {
  id: string;
  pubmed_id: string;
  doi: string | null;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  journal_issn: string | null;
  year: number;
  publication_date: string;
  databases_used: string[];
  additional_data_sources: string[];
  study_design: string | null;
  disease_area: string[];
  mesh_terms: string[];
  impact_factor: number | null;
  sjr_quartile: string | null;
  auto_detected: boolean;
  collected_at: string;
}
