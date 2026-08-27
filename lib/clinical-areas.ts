/**
 * 論文の「診療分野」を求める。
 *
 * OpenAlex のトピック（`openalex_topics`、関連度つき最大3件）を
 * `data/topic-areas.json` の辞書で日本の診療科に写像する。
 *
 * ## なぜ openalex_subfield を使わないか
 *
 * OpenAlex の subfield は、トピック→subfield の写像が固定表になっており、
 * その表自体が誤っている。「Gastric Cancer Management and Outcomes」の親が
 * 「Pulmonary and Respiratory Medicine」なので、胃癌の論文12件が全部「呼吸器」に入る。
 * 実測では subfield「呼吸器」82件のうち半分（胃癌12・前立腺癌8・大動脈6・乳癌3 …）が
 * 呼吸器と無関係だった。しかも subfield は1論文に1つしか付かないため、
 * 「乳がん患者の眼有害事象」を乳腺と眼科の両方に置くことができない。
 *
 * 辞書なら誤りを直せるうえ、1トピックに複数の分野を持たせられる。
 *
 * ## なぜ閾値が要るのか
 *
 * OpenAlex はスコア0のトピックまで返す。絞り込みは「入る/入らない」の二値なので、
 * 閾値なしだとスコア0.001のトピックでもその分野の結果に丸ごと入ってしまう。
 * 実測では「膠原病・リウマチ」が26件→73件に膨らみ、増えた分は
 * 頭蓋縫合早期癒合症・夜間ヘモグロビン尿症といった無関係な論文だった。
 *
 * 0.10 は実物を見て決めた。0.05まで下げると再現率は上がるが
 * （MeSHとの一致 71%→77%）、レカネマブ（アルツハイマー薬）に「膠原病」、
 * 乳がんのラジオ波焼灼に「消化器」といった誤りが混ざる。
 *
 * **関連研究の重み付けでは閾値を使わないこと。** あちらはスコアを係数として
 * 掛けるので、低スコアのトピックは自動的にほぼ効かなくなる。
 */

import topicAreas from "@/data/topic-areas.json";

/** 第2トピック以降を採用する下限。第1トピックはスコアに関わらず必ず採る */
export const AREA_SCORE_THRESHOLD = 0.1;

/** 表示順。件数ではなく診療科の並びで固定する（件数順だと選択のたびに動く） */
export const CLINICAL_AREAS: string[] = topicAreas.areas;

const TOPIC_TO_AREAS = topicAreas.topics as Record<string, string[] | undefined>;

type TopicLike = { name: string; score: number };

/**
 * 論文の診療分野。辞書に無いトピックと、どの分野にも落ちないトピック
 * （薬剤疫学・医療政策・統計手法など）は空として扱う。
 */
export function clinicalAreasOf(
  topics: TopicLike[] | null | undefined,
): string[] {
  if (!topics?.length) return [];
  const found = new Set<string>();
  topics.forEach((topic, index) => {
    if (index > 0 && topic.score < AREA_SCORE_THRESHOLD) return;
    for (const area of TOPIC_TO_AREAS[topic.name] ?? []) found.add(area);
  });
  // 分野の並びは CLINICAL_AREAS の順に揃える。トピックの順に任せると
  // 同じ組み合わせでもカードごとにバッジの並びが変わって落ち着かない。
  return CLINICAL_AREAS.filter((area) => found.has(area));
}

/**
 * 辞書の自己点検。ビルド時に一度だけ呼ぶ。
 *
 * 絞り込み値は URL に載るので、カンマが入ると旧 `?area=A,B` 形式との
 * 兼ね合いで壊れる。分野名の変更漏れもここで気づけるようにしておく。
 */
export function assertTopicAreasValid(): void {
  const known = new Set(CLINICAL_AREAS);
  for (const area of CLINICAL_AREAS) {
    if (area.includes(",")) {
      throw new Error(
        `topic-areas.json: 分野名 "${area}" にカンマは使えません（URLの区切りと衝突します）`,
      );
    }
  }
  for (const [topic, areas] of Object.entries(TOPIC_TO_AREAS)) {
    for (const area of areas ?? []) {
      if (!known.has(area)) {
        throw new Error(
          `topic-areas.json: トピック "${topic}" の分野 "${area}" は areas に無い値です`,
        );
      }
    }
  }
}
