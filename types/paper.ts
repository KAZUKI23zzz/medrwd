export interface Paper {
  id: string;
  pubmed_id: string;
  doi: string | null;
  title: string;
  title_ja?: string;
  abstract: string;
  abstract_ja?: string;
  authors: string[];
  journal: string;
  journal_issn: string | null;
  year: number;
  publication_date: string;
  databases_used: string[];
  additional_data_sources: string[];
  study_design: string;
  analysis_methods: string[];
  mesh_terms: string[];
  impact_factor: number | null;
  sjr_quartile: string | null;
  research_categories: string[];
  /**
   * OpenAlex の primary_topic（CC0）。疾患・診療領域の軸として使う。
   * `openalex_topic` は約4,500種の細かいトピック名、`openalex_subfield` は
   * その上位（Surgery / Oncology など）で、絞り込みの軸にはこちらを使う。
   * 未取得は undefined、取得を試みて得られなかった場合は null。
   */
  openalex_topic?: string | null;
  openalex_topic_score?: number | null;
  openalex_subfield?: string | null;
  openalex_field?: string | null;
  auto_detected: boolean;
  collected_at: string;
  medline_status?: string;
  last_updated?: string;
}
