/**
 * OpenAlex からトピック（関連度つき最大3件）と雑誌IFを取る。
 *
 * 収集スクリプトとバックフィルの両方から使う。以前は同じ処理が2箇所にあり、
 * 再試行・間隔・例外処理がそれぞれ食い違っていた。
 *
 * OpenAlex は 2026-02 に従量課金へ移行したが、singleton（/works/{id}、/sources/{id}）は
 * 課金対象外で、残高が尽きていても200を返す。list形式（?filter=）は課金対象なので使わない。
 * データは CC0。
 */

/**
 * polite pool 用の連絡先。OpenAlex は mailto を付けたリクエストを優遇する。
 * 実在しないアドレスを送るのは趣旨に反するので、環境変数で渡せるようにしてある。
 * 未設定なら匿名プールで叩く（singleton は課金対象外なので動作はする）。
 */
const MAILTO = process.env.OPENALEX_MAILTO;

/** 共有IPから叩くので、礼儀として間隔を空ける */
const MIN_INTERVAL_MS = 250;
const MAX_ATTEMPTS = 3;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;
async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function withMailto(url: string): string {
  if (!MAILTO) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}mailto=${encodeURIComponent(MAILTO)}`;
}

/**
 * 取得結果は3状態を区別する。ここを潰すとデータを壊す。
 * - ok: 200 が返った（`data` が中身。primary_topic が無いこともある）
 * - absent: 404。OpenAlex にその論文/雑誌が無い
 * - failed: それ以外（5xx・429・ネットワーク例外）。**既存の値を上書きしてはいけない**
 */
export type FetchResult<T> =
  | { status: "ok"; data: T }
  | { status: "absent" }
  | { status: "failed"; reason: string };

async function getJson<T>(url: string): Promise<FetchResult<T>> {
  let lastReason = "unknown";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle();
    try {
      const res = await fetch(withMailto(url));
      if (res.ok) return { status: "ok", data: (await res.json()) as T };
      if (res.status === 404) return { status: "absent" };
      lastReason = `HTTP ${res.status}`;
      // 429 は singleton では起きないはずだが、起きたら待って試し直す
      if (res.status === 429 || res.status >= 500) {
        const body = (await res.text()).slice(0, 120);
        lastReason = `HTTP ${res.status} ${body}`;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(2000 * attempt);
          continue;
        }
      }
      return { status: "failed", reason: lastReason };
    } catch (e) {
      // ネットワーク例外。ここを捕まえないと呼び出し側ごと落ちる
      lastReason = (e as Error).message;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(2000 * attempt);
        continue;
      }
    }
  }
  return { status: "failed", reason: lastReason };
}

/**
 * OpenAlex が1論文に付けるトピックの1つ。score は0〜1の関連度。
 *
 * `id` は `T10183` の短い形（応答は `https://openalex.org/T10183` で返る）。
 * 診療分野の辞書 `data/topic-areas.json` はこのIDで引く。名前で引かないのは、
 * OpenAlex がトピックを改名したときに写像が黙って外れるのを避けるため。
 */
export type ScoredTopic = { id: string; name: string; score: number };

export type TopicFields = {
  openalex_topic: string | null;
  openalex_topic_score: number | null;
  openalex_subfield: string | null;
  openalex_field: string | null;
  /**
   * トピックを関連度つきで全件（OpenAlex は最大3件返す）。スコアの降順。
   * `openalex_topic` はこの先頭と同じ値で、既存の表示・検索がそのまま動くよう残してある。
   */
  openalex_topics: ScoredTopic[] | null;
};

/** 取得できなかった（＝既存値を残すべき）ことを表す */
export const TOPIC_UNAVAILABLE = null;

type Topic = {
  id?: string;
  display_name?: string;
  score?: number;
  subfield?: { display_name: string };
  field?: { display_name: string };
};
type Work = { topics?: Topic[] | null };

/**
 * 論文のトピックを取る。
 * 戻り値が null なら「取得に失敗した」＝呼び出し側は既存の値を触らないこと。
 * 200 が返ってトピックが無い場合と404の場合は、全フィールド null のオブジェクトを返す。
 *
 * `primary_topic` ではなく `topics`（最大3件、関連度つき）を取る。
 * 以前は第1トピックだけを取り「第2・第3はスコア0.00〜0.06でほぼノイズ」としていたが、
 * 実測すると第1の確信度が低い論文では第2に意味のあるスコアが載っていた
 * （例: 乳がん周術期化学療法の論文は 0.751 好中球減少症 / 0.103 乳がん治療）。
 * 第1が 0.98 のように確信的な論文でのみ第2が 0.008 まで落ちる。
 * 診療分野を1論文に複数付けるにはこの第2以降が要る。
 */
export async function fetchTopic(
  pubmedId: string,
): Promise<TopicFields | typeof TOPIC_UNAVAILABLE> {
  const empty: TopicFields = {
    openalex_topic: null,
    openalex_topic_score: null,
    openalex_subfield: null,
    openalex_field: null,
    openalex_topics: null,
  };
  const res = await getJson<Work>(
    `https://api.openalex.org/works/pmid:${pubmedId}?select=id,topics`,
  );
  if (res.status === "failed") {
    console.warn(`  OpenAlex topic 取得失敗 PMID ${pubmedId}: ${res.reason}`);
    return TOPIC_UNAVAILABLE;
  }
  if (res.status === "absent") return empty;

  const round = (n: number) => Math.round(n * 1000) / 1000;
  // id が無いトピックは辞書を引けないので捨てる。実際には OpenAlex は必ず返すが、
  // 黙って名前だけのトピックが混ざると診療分野が付かない原因が分からなくなる。
  const topics = (res.data.topics ?? []).filter(
    (t): t is Topic & { id: string; display_name: string; score: number } =>
      typeof t?.id === "string" &&
      typeof t.display_name === "string" &&
      typeof t.score === "number",
  );
  const dropped = (res.data.topics ?? []).length - topics.length;
  if (dropped > 0)
    console.warn(`  PMID ${pubmedId}: id か score が無いトピックを${dropped}件捨てた`);
  if (topics.length === 0) return empty;

  // OpenAlex はスコア降順で返すが、依存しないよう明示的に並べ替える
  const sorted = [...topics].sort((a, b) => b.score - a.score);
  const primary = sorted[0];
  return {
    openalex_topic: primary.display_name,
    openalex_topic_score: round(primary.score),
    openalex_subfield: primary.subfield?.display_name ?? null,
    openalex_field: primary.field?.display_name ?? null,
    openalex_topics: sorted.map((t) => ({
      // `https://openalex.org/T10183` → `T10183`
      id: t.id.replace(/^.*\//, ""),
      name: t.display_name,
      score: round(t.score),
    })),
  };
}

type Source = { summary_stats?: { "2yr_mean_citedness"?: number } };

const issnCache = new Map<string, number | null>();

/**
 * 雑誌の2年平均被引用数を取る。
 * 戻り値が undefined なら取得失敗＝呼び出し側は既存の値を触らないこと。
 * IF が 0 の雑誌は実在するので、0 を「無い」と混同しないこと。
 */
export async function fetchImpactFactor(
  issn: string,
): Promise<number | null | undefined> {
  if (issnCache.has(issn)) return issnCache.get(issn);

  const res = await getJson<Source>(
    `https://api.openalex.org/sources/issn:${issn}`,
  );
  if (res.status === "failed") {
    console.warn(`  OpenAlex IF 取得失敗 ISSN ${issn}: ${res.reason}`);
    return undefined;
  }
  const raw = res.status === "ok" ? res.data.summary_stats?.["2yr_mean_citedness"] : undefined;
  const value = typeof raw === "number" ? Math.round(raw * 100) / 100 : null;
  issnCache.set(issn, value);
  return value;
}
