/**
 * `data/unknown-topics.json` の形。
 *
 * OpenAlex が新設・改名したトピックのうち、診療分野の辞書
 * （`data/topic-areas.json`）にまだ無いものを溜めておく置き場。
 * 収集のたびに `scripts/unknown-topics.ts` が作り直し、`/status` で見える。
 */

/** 辞書に無いトピック。その論文には診療分野が付いていない */
export interface UnknownTopic {
  /** OpenAlex のトピックID（`T14999`） */
  id: string;
  name: string;
  /** この一覧に最初に載った日（YYYY-MM-DD）。棚卸しの目安に使う */
  first_seen: string;
  /** そのトピックを持つ論文の数 */
  papers: number;
  /** 分野を判断するときの手がかり。多いときは先頭5件だけ */
  example_pmids: string[];
}

/**
 * 改名されたトピック。診療分野はIDで引いているので影響はなく、
 * 辞書側の `name` を新しい名前に直せばよい。
 */
export interface RenamedTopic {
  id: string;
  dictionary_name: string;
  openalex_name: string;
  papers: number;
}

export interface UnknownTopicsFile {
  _readme: string[];
  updated_at: string;
  unknown: UnknownTopic[];
  renamed: RenamedTopic[];
}
