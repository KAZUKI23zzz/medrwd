/**
 * データベースの区分。「誰がデータを保有しているか」で分ける。
 *
 * 有償か無償かでは分けない。公的DBにも利用料があり（MID-NET には PMDA が
 * 料金表を公表している）、民間DBにも無償提供がある（DeSC は研究公募で無償）ため、
 * 費用を軸にすると実態と合わなくなる。
 */
export type DatabaseType = "public" | "private";

/** 区分の表示名。バッジと見出しで同じ言葉を使う */
export const DATABASE_TYPE_LABEL: Record<DatabaseType, string> = {
  public: "公的",
  private: "民間",
};

/** バッジの色。文字（DATABASE_TYPE_LABEL）と同じ表から引いて、直し漏れを防ぐ */
export const DATABASE_TYPE_VARIANT: Record<DatabaseType, "default" | "secondary"> = {
  public: "default",
  private: "secondary",
};

/** 一覧の見出しに添える、区分の定義 */
export const DATABASE_TYPE_DESCRIPTION: Record<DatabaseType, string> = {
  public: "国・公的機関や学会が、制度として収集しているもの",
  private: "民間事業者が事業として保有しているもの",
};

export interface RWDDatabase {
  slug: string;
  name: string;
  name_en: string;
  /** 保有主体による区分（有償・無償では分けない） */
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

export interface PrivateDBLink {
  company: string;
  description: string;
  url: string;
  pdf_url?: string;
}
