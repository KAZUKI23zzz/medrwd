export interface RWDDatabase {
  slug: string;
  name: string;
  name_en: string;
  type: "public" | "commercial";
  administrator: string;
  /**
   * 論文側の `databases_used` に入っている名前。
   * 研究カタログの絞り込みと数を一致させるため、部分一致ではなくこの値で突き合わせる。
   * （以前は名前の部分一致で集めており、NDB のページに NDBオープンデータ の58件が
   *   混ざって「96件」と「153件」が食い違っていた）
   */
  paper_tag: string;
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
