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
  /**
   * PubMed の MedlineCitation Status（MEDLINE / In-Process / Publisher /
   * PubMed-not-MEDLINE）。収集時の値を記録するだけで、UI からは参照していない。
   *
   * 以前は「Publisher / In-Process の論文を月1回取り直し、MEDLINE になったら打ち切る」
   * という追跡に使っていたが、収集をRoutine一本化した際にその処理ごと削除した。
   * そのため last_updated は 2026-05-18 を最後に更新されていない。
   */
  medline_status?: string;
  /** 上記の再取得で最後に取り直した時刻。再取得を廃止したので現在は増えない */
  last_updated?: string;
}

/**
 * 研究カタログの一覧（/papers）へ渡す論文。
 *
 * 一覧は全論文をクライアントへ渡して絞り込む作りなので、1件あたりの重さが
 * そのまま初回表示の転送量になる。そこで「一覧が実際に使うフィールド」だけを
 * 列挙し、それ以外は app/papers/page.tsx で落としている。
 *
 * 除外リストではなく許可リストにしてあるのは、papers.json にフィールドが
 * 増えたときの挙動を安全側に倒すため。除外リストだと、新しいフィールドは
 * 誰も気づかないまま全件ぶん配信されてしまう。許可リストなら配信されず、
 * 一覧で必要になった時点で型エラーとして表面化する。
 *
 * 追加するときは、この Pick と app/papers/page.tsx の写し取りの両方に足すこと。
 * 必須フィールドなら片方だけでビルドが落ちる。
 */
export type ListPaper = Pick<
  Paper,
  | "id"
  | "pubmed_id"
  | "doi"
  | "title"
  | "title_ja"
  | "abstract"
  | "abstract_ja"
  | "authors"
  | "journal"
  | "year"
  | "publication_date"
  | "databases_used"
  | "additional_data_sources"
  | "study_design"
  | "analysis_methods"
  | "research_categories"
  | "impact_factor"
  | "sjr_quartile"
  | "openalex_subfield"
  | "openalex_topic"
>;
