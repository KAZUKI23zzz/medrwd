import { getPapers } from "@/lib/data-loader";
import type { Paper } from "@/types/paper";

/**
 * 関連研究の算出。
 *
 * 以前は「同じDBを使った論文の先頭5件」を出していたが、papers.json が日付降順のため
 * 実質「同じDBの最新5件」になり、DPC論文221件すべてで同じ5件が表示されていた。
 * 話題の関連性をまったく見ていなかったため、本文ベースの類似度に置き換えている。
 *
 * 20本の論文を層化抽出し、2人の評価者に手法名を伏せて0〜3点で採点させた結果
 * （2人の平均点）:
 *
 * |                    | 平均点 | 2点以上 | 0点 | 候補が出た論文 |
 * |--------------------|--------|---------|-----|----------------|
 * | 本実装             | 2.11   | 65%     | 1%  | 20/20          |
 * | 旧実装(同DB最新5件)| 0.63   | 13%     | 52% | 15/20          |
 *
 * 評価者間の一致は 完全一致64% / ±1以内99% / r=0.89。
 *
 * 計算はビルド時に一度だけ行い、結果はHTMLに焼き込まれる。事前計算した
 * JSONをコミットする方式にしないのは、data/papers.json を週次のRoutineが
 * 書き換えるため。ビルドのたびに再計算すれば運用が増えない。
 */

/** 表示件数。閾値を下回る場合はこれに満たなくてよい（無関係な論文で枠を埋めない） */
const TOP_K = 5;

/**
 * BM25コサインの足切り。0.15〜0.22 を実測で比較したところ、上げても質はほとんど
 * 変わらない（平均2.11→2.29）のに候補の出る論文が 20/20 → 15/20 まで落ちたため
 * 0.15 を採用している。この閾値でも0点は1%しかない。
 */
const MIN_SIMILARITY = 0.15;

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** 稀すぎる語（タイプミス等）と、ほぼ全論文に出る語を落とす */
const MIN_DF = 3;
const MAX_DF_RATIO = 0.25;

/** タイトルは抄録より話題を強く表すので、語を複製して重みを上げる */
const TITLE_REPEAT = 3;

/**
 * タグ一致による加点。本文類似のタイブレークとして効かせる。
 * メタデータ単体では順位が付かない（DB・デザイン・カテゴリが完全一致する組は
 * 最大48件が同点になる）ので、あくまで乗算の補正にとどめる。
 * 「同じDBか」より「同じ話題か」を優先する。
 *
 * 値を差し替えて比較できるよう引数で渡せるようにしてある。
 * 実際に2案をブラインド評価で比べて決めた（docs/related-papers.md）。
 */
export type BoostWeights = {
  /** OpenAlex の細かいトピック（364種）が一致 */
  topic: number;
  /** 診療領域（OpenAlex subfield、74種）が一致 */
  area: number;
  category: number;
  database: number;
  method: number;
  design: number;
};

export const DEFAULT_BOOSTS: BoostWeights = {
  topic: 0.18,
  area: 0.08,
  category: 0.12,
  database: 0.06,
  method: 0.05,
  design: 0.03,
};

/**
 * 英語の一般語に加え、この分野のほぼ全論文に出る語を落とす。
 * MAX_DF_RATIO でも大半は落ちるが、明示しておいた方が意図が伝わる。
 */
const STOP_WORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your
   study studies patients patient using used use data database results result conclusion conclusions background methods method objective objectives aim aims purpose analysis analyses associated association significant significantly among between during however also although these those may might could observed found showed shown demonstrate demonstrated included including total number rate rates risk group groups compared comparison respectively ci
   japan japanese japans national nationwide retrospective cohort cross sectional observational real world rwd claims year years age aged sex male female mean median sd iqr`
    .split(/\s+/)
    .filter(Boolean),
);

/** 語尾のゆれを吸収する簡易ステマー。Porter相当は依存が増えるので入れない */
function stem(word: string): string {
  return word
    .replace(/(ies)$/, "y")
    .replace(/(sses|shes|ches|xes)$/, (m) => m.slice(0, -2))
    .replace(/([^s])s$/, "$1")
    .replace(/(ing|ed)$/, "");
}

/**
 * 類似度は英語の title + abstract から取る。abstract_ja は全文訳ではなく
 * 2〜3文のAI要約で、中央値181文字（英語抄録は1,752文字）しかなく信号が薄い。
 * 表示は日本語、計算は英語、と分けている。
 */
function tokenize(paper: Paper): string[] {
  const title = `${paper.title ?? ""} `.repeat(TITLE_REPEAT);
  const text = `${title}${paper.abstract ?? ""}`.toLowerCase();
  const tokens: string[] = [];
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || raw.length > 30) continue;
    if (/^\d+$/.test(raw)) continue;
    if (STOP_WORDS.has(raw)) continue;
    const word = stem(raw);
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    tokens.push(word);
  }
  return tokens;
}

type Index = {
  papers: Paper[];
  /** 論文ごとの、L2正規化済みBM25ベクトル */
  vectors: Map<string, number>[];
  /** 語 → その語を含む[論文の位置, 重み] のリスト */
  postings: Map<string, [number, number][]>;
  indexById: Map<string, number>;
};

let cached: Index | null = null;

function buildIndex(): Index {
  const papers = getPapers();
  const docs = papers.map(tokenize);
  const total = docs.length;

  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const word of new Set(doc)) df.set(word, (df.get(word) ?? 0) + 1);
  }
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / (total || 1);
  const maxDf = total * MAX_DF_RATIO;

  const vectors = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const word of doc) tf.set(word, (tf.get(word) ?? 0) + 1);

    const vector = new Map<string, number>();
    let norm = 0;
    for (const [word, freq] of tf) {
      const n = df.get(word) ?? 0;
      if (n < MIN_DF || n > maxDf) continue;
      const idf = Math.log(1 + (total - n + 0.5) / (n + 0.5));
      const weight =
        (idf * (freq * (BM25_K1 + 1))) /
        (freq + BM25_K1 * (1 - BM25_B + (BM25_B * doc.length) / avgLength));
      vector.set(word, weight);
      norm += weight * weight;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [word, weight] of vector) vector.set(word, weight / norm);
    return vector;
  });

  // 転置索引。全ペアを回すより速く、語彙を共有しない組を最初から見なくて済む
  const postings = new Map<string, [number, number][]>();
  vectors.forEach((vector, i) => {
    for (const [word, weight] of vector) {
      const list = postings.get(word);
      if (list) list.push([i, weight]);
      else postings.set(word, [[i, weight]]);
    }
  });

  return {
    papers,
    vectors,
    postings,
    indexById: new Map(papers.map((p, i) => [p.id, i])),
  };
}

function getIndex(): Index {
  if (!cached) cached = buildIndex();
  return cached;
}

function overlaps(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  return a.some((x) => b.includes(x));
}

export type RelatedPaper = {
  paper: Paper;
  /** タグ加点まで含めた最終スコア。表示には使わないがデバッグで効く */
  score: number;
  /** 本文だけの類似度（0〜1） */
  similarity: number;
};

export function getRelatedPapers(
  paperId: string,
  limit = TOP_K,
  boosts: BoostWeights = DEFAULT_BOOSTS,
): RelatedPaper[] {
  const { papers, vectors, postings, indexById } = getIndex();
  const self = indexById.get(paperId);
  if (self === undefined) return [];

  const source = papers[self];
  const scores = new Map<number, number>();
  for (const [word, weight] of vectors[self]) {
    const list = postings.get(word);
    if (!list) continue;
    for (const [other, otherWeight] of list) {
      if (other === self) continue;
      scores.set(other, (scores.get(other) ?? 0) + weight * otherWeight);
    }
  }

  const candidates: RelatedPaper[] = [];
  for (const [other, similarity] of scores) {
    if (similarity < MIN_SIMILARITY) continue;
    const target = papers[other];
    let boost = 1;
    if (source.openalex_topic && source.openalex_topic === target.openalex_topic)
      boost += boosts.topic;
    if (
      source.openalex_subfield &&
      source.openalex_subfield === target.openalex_subfield
    )
      boost += boosts.area;
    if (overlaps(source.research_categories, target.research_categories))
      boost += boosts.category;
    if (overlaps(source.databases_used, target.databases_used))
      boost += boosts.database;
    if (overlaps(source.analysis_methods, target.analysis_methods))
      boost += boosts.method;
    if (source.study_design && source.study_design === target.study_design)
      boost += boosts.design;
    candidates.push({ paper: target, score: similarity * boost, similarity });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}
