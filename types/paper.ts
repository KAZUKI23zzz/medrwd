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
  /**
   * PubMed に収載された日（Entrez Date / EDAT, `YYYY-MM-DD`）と、その年。
   *
   * **出版日ではない。** 誌面の出版日（PubDate）は35%で日が欠け12%は年だけなので、
   * 並び替え・絞り込みの軸に使えない。EDAT は全件で年月日が揃い、一度付いたら
   * 動かない。収集の検索窓（reldate=90、datetype 省略＝edat）とも同じ軸になる。
   * 経緯は scripts/sync-pubmed.ts の extractEntrezDate を参照。
   */
  entrez_year: number;
  entrez_date: string;
  databases_used: string[];
  additional_data_sources: string[];
  study_design: string;
  analysis_methods: string[];
  impact_factor: number | null;
  sjr_quartile: string | null;
  research_categories: string[];
  /**
   * OpenAlex の primary_topic（CC0）。`openalex_topics` の先頭と同じ値で、
   * 互換のために残してある。検索の対象に入れているほかは表示にも使わない。
   *
   * `openalex_subfield` / `openalex_field` は**使っていない**。OpenAlex 側の
   * トピック→subfield 写像が誤っているため（胃癌→呼吸器など。経緯は
   * lib/clinical-areas.ts のコメント）。比較用にデータには残している。
   *
   * 未取得は undefined、取得を試みて得られなかった場合は null。
   */
  openalex_topic?: string | null;
  openalex_topic_score?: number | null;
  /**
   * トピックを関連度つきで全件（OpenAlex は最大3件返す）。スコアの降順で、
   * 先頭は `openalex_topic` と同じ値。1論文が複数の診療分野にまたがることを
   * 表すために使う（例: 乳がん患者の眼有害事象 → 眼科＋乳腺）。
   *
   * `id` は `T10183` の形。診療分野の辞書はこのIDで引く（名前で引くと
   * OpenAlex の改名で写像が黙って外れる）。lib/clinical-areas.ts 参照。
   */
  openalex_topics?: { id: string; name: string; score: number }[] | null;
  openalex_subfield?: string | null;
  openalex_field?: string | null;
  auto_detected: boolean;
  collected_at: string;
  /** 過去の再取得で最後に取り直した時刻。再取得を廃止したので現在は増えない */
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
  | "entrez_year"
  | "entrez_date"
  | "databases_used"
  | "additional_data_sources"
  | "study_design"
  | "analysis_methods"
  | "research_categories"
  | "impact_factor"
  | "sjr_quartile"
> & {
  /**
   * 算出済みの診療分野（lib/clinical-areas.ts）。Paper には無い派生値で、
   * 一覧はこれを絞り込み・バッジ・検索に使う。
   */
  clinical_areas: string[];
  /**
   * OpenAlex のトピック名だけを取り出したもの（スコアは落とす）。
   * 一覧のカードには出さないが、"sepsis" のような英語のトピック名で
   * 検索に引っかかるようにするために配信する。スコアつきの生の
   * `openalex_topics` は一覧では使わないので配信していない。
   */
  topic_names: string[];
};
