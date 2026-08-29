import { getPapers } from "@/lib/data-loader";
import { clinicalAreasOf, AREA_SCORE_THRESHOLD } from "@/lib/clinical-areas";
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

/**
 * 詳細ページに渡す候補の数。表示するのは先頭5件だが、利用者が診療分野・トピック・
 * DBで絞り込めるようにするため、多めに持たせておく（絞ったときに中身が無いと困る）。
 * 15件で1ページあたり生JSONが約3.4KB。圧縮後の増分はごくわずか。
 */
const CANDIDATE_K = 15;

// 画面に出す件数は components/papers/RelatedPapers.tsx が持つ。
// このモジュールは data/papers.json を読むので、クライアントから import させない。

/**
 * BM25コサインの足切り。
 *
 * 当初は 0.15〜0.22 を比べて 0.15 にしていた（上げても質はほとんど変わらないのに
 * 候補の出る論文が 20/20 → 15/20 まで落ちたため）。
 *
 * 2026-08-29 に 0.12 へ緩めた。詳細ページで絞り込めるようにしたので、
 * 絞ったときの母数が要るため。緩めた効果は実測で:
 *
 * | 足切り | 候補の中央値 | 候補5件未満 | 候補0件 |
 * |---|---|---|---|
 * | 0.15 | 8件 | 253件 | 21件 |
 * | 0.12 | 17件 | 41件 | **0件** |
 *
 * 関連研究が1件も出ない論文が無くなる。下位には従来より弱い候補が入るが、
 * 論文が増えれば自然に押し出される。
 */
const MIN_SIMILARITY = 0.12;

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
  /** 診療分野の重なり（`areaSimilarity`、0〜1）に掛ける */
  area: number;
  /** OpenAlex のトピックの重なり（`topicSimilarity`、0〜1）に掛ける */
  topic: number;
};

/**
 * 加点の重み。
 *
 * 「一致したら定数を足す」ではなく、0〜1の重なり具合を掛ける。
 * 0.3/0.2 と 0.5/0.3 は実測で同じ成績だったので、動きの小さいほうを採った。
 * 効くのは正確な値ではなく、**何を足して何を足さないか**のほう。
 */
export const DEFAULT_BOOSTS: BoostWeights = {
  area: 0.3,
  topic: 0.2,
};

/**
 * 加点の実測値（候補13,864組）。トピック側は関連度が両側から掛かるので、
 * 名目の 0.2 には届かない。「Aの主題＝Bの主題」のときだけ満点に近づく作り。
 *
 * | 組み合わせ | 組数 | 加点の中央値 |
 * |---|---|---|
 * | 同トピック かつ 同診療分野 | 2,960 | 0.440 |
 * | 同診療分野のみ | 3,698 | 0.300 |
 * | 同トピックのみ | 765 | 0.108 |
 * | どちらも該当しない | 6,441 | 0 |
 */

/**
 * ## 並べ替えは単一のスコア順。絞り込みは利用者に任せる
 *
 * 「JADERで不均衡分析をした」という共通点だけで薬剤も疾患も違う論文が並ぶ、
 * という問題があった。手法が同じこと自体は悪くない。**分野を無視して手法だけで
 * 並ぶのが問題**である。
 *
 * これをスコアの重み付けだけで解こうとすると、ある利用者には正解でも別の
 * 利用者には不正解になる（「DPCで他にどんな研究があるか」を見たい人にとっては
 * 同じDBで並ぶことこそが目的）。そこで順序は単一のスコアに任せ、
 * 診療分野・トピック・DBでの絞り込みを詳細ページの UI として出している
 * （components/papers/RelatedPapers.tsx）。絞り込みの母数を確保するため、
 * 表示は5件でも候補は CANDIDATE_K 件まで渡す。
 *
 * ## 加点しない項目（研究カテゴリ・使用DB・解析手法・研究デザイン）
 *
 * 以前はこの4つにも加点していた（category 0.12 / database 0.06 / method 0.05 /
 * design 0.03）。2026-08-29 に全部やめた。**話題の一致に対して逆相関だったため。**
 *
 * MeSHの重なりを独立した参照にして、足切りを通った候補2,938組で測った結果:
 *
 * | 信号 | AUC |
 * |---|---|
 * | BM25コサイン | 0.753 |
 * | 診療分野 | 0.681 |
 * | トピック | 0.645 |
 * | 研究カテゴリ | **0.456** |
 * | 使用DB | **0.443** |
 * | 解析手法 | **0.439** |
 *
 * 0.5 が「情報なし」なので、下3つは足すと無関係な論文を押し上げていた。
 * 実際、新しい式にこの3つを足し戻すと成績が落ちる（cat −0.012 / db −0.008 /
 * method −0.007）。design は ±0.001 で無害だが、効かないので置かない。
 *
 * **この測定には落とし穴がある。** MeSHには「JADERを使った」ことに紐づく語が混ざる
 * （JADER論文の96%が `Adverse Drug Reaction Reporting Systems` を持つ）。これを
 * 除かずに測ると結論が反転し、DBに大きな重みを置くのが最善に見えてしまう。
 * DB由来のMeSHを除いて初めて上の並びになる。
 *
 * 除いたほうが正しいことは、人手のブラインド評価が独立に裏づけている。評価者2名が
 * どちらも「同じDB・同じ不均衡分析というだけで薬剤も疾患も違うJADER論文が並ぶ」
 * 「機械学習・Markovモデル・中断時系列といったデザイン語で引っ張られる」と
 * 指摘した。汚染された指標は、人が誤りと呼んだ挙動をちょうど高く評価する。
 *
 * 経緯は docs/related-papers.md の「4回目」に書いてある。
 */

/**
 * 診療分野の重なり（0〜1）。
 *
 * 共通集合を「少ないほうの分野数」で割る。Jaccard にすると
 * 「血液・乳腺・感染症」と「乳腺」が 1/3 になってしまい、分野を多く持つ論文が
 * 一律に不利になる。実測では 1.0 が2,266組・0.5 が175組で、ほぼ二値に近い。
 */
export function areaSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const shared = a.filter((x) => b.includes(x)).length;
  return shared / Math.min(a.length, b.length);
}

/**
 * トピックの重なり（0〜1）。共有するトピックについて、両者の関連度スコアの積を足す。
 *
 * **閾値は使わない。** スコアをそのまま係数にすれば、関連度0.001のトピックを
 * 共有していても 0.001×0.9=0.0009 にしかならず、自動的に効かなくなる。
 * 診療分野の絞り込み（lib/clinical-areas.ts）が閾値0.10を使うのとは扱いが逆で、
 * あちらは「入る/入らない」の二値だから閾値が要る。
 *
 * スコアは1より小さい値なので、積は素直に小さくなる。実測では候補の55%が>0で、
 * 中央値0.005・p90が0.943と、同じ話題の組だけがはっきり立ち上がる。
 * OpenAlex のスコアは合計が1に正規化されていない（最大2.999の論文がある）ため、
 * 稀に1を超える。二重に効かないよう1で頭打ちにする（p99=0.994なので影響は1%未満）。
 */
export function topicSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0;
  for (const [id, score] of b) dot += (a.get(id) ?? 0) * score;
  return Math.min(1, dot);
}

/**
 * トピック加点を「そのトピックの珍しさ」で薄める案を試したが、**実測で否定された**。
 *
 * 動機は妥当に見えた。トピック最大の
 * 「Pharmacovigilance and Adverse Drug Reactions」には50件が集まり、うち47件が
 * JADER論文なので、一致しても「これは安全性研究である」というラベルにしかならない。
 * 実際、加点導入時のブラインド評価で負けた上位2 seedはどちらもJADERだった。
 *
 * そこで本文のIDFと同じ理屈で頻出トピックの加点を下げたところ、影響を受ける
 * 30 seedのブラインド評価で **薄めた方が悪化した**（薄めた側 1.59 対 そのまま 1.95、
 * seed単位で8勝17敗5分）。頻出トピックで得るものより、効いている側を弱める損の方が
 * 大きい。**この方向で再挑戦しないこと。**
 *
 * JADER論文が近傍で弱いのは、トピック加点ではなく本文側の問題だと考えられる。
 * 評価者が指摘したとおり、抄録の語彙（ROR / PRR / 不均衡分析 / シグナル検出）が
 * 定型的すぎて、被疑薬名ではなく方法論の定型文に類似度が反応している。
 * MAX_DF_RATIO は25%だがJADER論文はコーパスの12%しかないため、これらの語が
 * 生き残ってしまう。手を入れるならストップワード側。
 */

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

/**
 * 語尾のゆれを吸収する簡易ステマー。Porter相当は依存が増えるので入れない。
 *
 * 語尾を落とすのは、残りが3文字以上になる場合だけ。無条件に落としていた頃は
 * bed/beds→"b"、ring/rings→"r"、hrs→"hr"、los→"lo"、aes→"ae" のように潰れており、
 * 3文字未満は tokenize が捨てるので索引から消えていた。実データで延べ7,363回。
 * DPC研究の「病床」、ハザード比(hrs)、在院日数(los)、有害事象(aes)が該当する。
 *
 * -eed で終わる語（bleed / feed / need / exceed / breed …）は落とさない。Porter の
 * step 1b と同じ扱いで、これが無いと bleeding→"bleed" と bleed→"ble" が別語に割れる。
 * 出血は抗凝固薬の安全性研究の中心的な語なので、割れると近傍の質に響く。
 *
 * 既知の残り: 複数形規則が -sis / -us で終わる単数形も削っている
 * （analysis→"analysi"、osteoporosis→"osteoporosi"、status→"statu" 等。
 * 289種・延べ5,725回）。全論文が同じ処理を通るので取りこぼしは生まれず、
 * 実害は focus→"focu" と focused→"focus" のような語族の分裂だけ。
 * `([^s])s$` を `([^siu])s$` にすれば直るが、近傍の質が上がるかは
 * ブラインド評価（docs/related-papers.md の手順）で測ってからにすること。
 */
function stem(word: string): string {
  const plural = word
    .replace(/(ies)$/, "y")
    .replace(/(sses|shes|ches|xes)$/, (m) => m.slice(0, -2))
    .replace(/([^s])s$/, "$1");
  const base = plural.length >= 3 ? plural : word;
  if (/eed$/.test(base)) return base;
  const trimmed = base.replace(/(ing|ed)$/, "");
  return trimmed.length >= 3 ? trimmed : base;
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
  /** 論文ごとの診療分野。papers と同じ並び。加点のたびに引き直さないよう先に作る */
  areas: string[][];
  /** 論文ごとの トピックID → 関連度。同上 */
  topicScores: Map<string, number>[];
  /**
   * 論文ごとの、絞り込みに使うトピックID（関連度0.10以上のみ）。
   * スコア計算に使う topicScores とは別物。あちらは関連度を係数として掛けるので
   * 低いトピックも入れてよいが、絞り込みは「入る/入らない」の二値なので閾値が要る。
   * lib/clinical-areas.ts の AREA_SCORE_THRESHOLD と同じ考え方。
   */
  filterTopicIds: string[][];
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
    areas: papers.map((p) => clinicalAreasOf(p.openalex_topics)),
    topicScores: papers.map(
      (p) => new Map((p.openalex_topics ?? []).map((t) => [t.id, t.score])),
    ),
    filterTopicIds: papers.map((p) =>
      (p.openalex_topics ?? [])
        .filter((t) => t.score >= AREA_SCORE_THRESHOLD)
        .map((t) => t.id),
    ),
  };
}

function getIndex(): Index {
  if (!cached) cached = buildIndex();
  return cached;
}

export type RelatedPaper = {
  paper: Paper;
  /** 加点まで含めた最終スコア。この降順に並ぶ */
  score: number;
  /** 本文だけの類似度（0〜1） */
  similarity: number;
  /** 絞り込みの照合に使う。この候補が持つ診療分野 */
  clinical_areas: string[];
  /**
   * 絞り込みの照合に使う。この候補が持つトピックID。
   * 関連度0.10未満のトピックは入れない。付随的なトピックまで拾うと、
   * 「同じトピック」で絞ったのに主題の違う論文が並ぶため。
   */
  topic_ids: string[];
};

export function getRelatedPapers(
  paperId: string,
  limit = CANDIDATE_K,
  boosts: BoostWeights = DEFAULT_BOOSTS,
): RelatedPaper[] {
  const {
    papers,
    vectors,
    postings,
    indexById,
    areas,
    topicScores,
    filterTopicIds,
  } = getIndex();
  const self = indexById.get(paperId);
  if (self === undefined) return [];

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
    // 話題が重なるほど押し上げる。研究カテゴリ・DB・解析手法・研究デザインは
    // 加点しない（下の「加点しない項目」を参照）
    const boost =
      1 +
      boosts.area * areaSimilarity(areas[self], areas[other]) +
      boosts.topic * topicSimilarity(topicScores[self], topicScores[other]);
    candidates.push({
      paper: target,
      score: similarity * boost,
      similarity,
      clinical_areas: areas[other],
      topic_ids: filterTopicIds[other],
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}
