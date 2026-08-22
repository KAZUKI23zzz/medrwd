export type DatabaseType = "public" | "commercial" | "other";

/** 区分の表示名。バッジと見出しで同じ言葉を使う */
export const DATABASE_TYPE_LABEL: Record<DatabaseType, string> = {
  public: "公的",
  commercial: "商業",
  other: "その他",
};

export interface RWDDatabase {
  slug: string;
  name: string;
  name_en: string;
  /**
   * 提供のされ方による区分。
   *  - public:     公的機関が整備・提供
   *  - commercial: 事業者が有償で提供
   *  - other:      上記のどちらでもない（研究公募による無償提供など）
   */
  type: DatabaseType;
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
