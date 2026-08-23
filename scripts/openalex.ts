/**
 * OpenAlex から診療領域（primary_topic）と雑誌IFを取る。
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

export type TopicFields = {
  openalex_topic: string | null;
  openalex_topic_score: number | null;
  openalex_subfield: string | null;
  openalex_field: string | null;
};

/** 取得できなかった（＝既存値を残すべき）ことを表す */
export const TOPIC_UNAVAILABLE = null;

type Work = {
  primary_topic?: {
    display_name: string;
    score: number;
    subfield?: { display_name: string };
    field?: { display_name: string };
  } | null;
};

/**
 * 論文の診療領域を取る。
 * 戻り値が null なら「取得に失敗した」＝呼び出し側は既存の値を触らないこと。
 * 200 が返ってトピックが無い場合と404の場合は、全フィールド null のオブジェクトを返す。
 */
export async function fetchTopic(
  pubmedId: string,
): Promise<TopicFields | typeof TOPIC_UNAVAILABLE> {
  const empty: TopicFields = {
    openalex_topic: null,
    openalex_topic_score: null,
    openalex_subfield: null,
    openalex_field: null,
  };
  const res = await getJson<Work>(
    `https://api.openalex.org/works/pmid:${pubmedId}?select=id,primary_topic`,
  );
  if (res.status === "failed") {
    console.warn(`  OpenAlex topic 取得失敗 PMID ${pubmedId}: ${res.reason}`);
    return TOPIC_UNAVAILABLE;
  }
  if (res.status === "absent") return empty;

  const topic = res.data.primary_topic;
  if (!topic?.display_name) return empty;
  return {
    openalex_topic: topic.display_name,
    openalex_topic_score: Math.round(topic.score * 1000) / 1000,
    openalex_subfield: topic.subfield?.display_name ?? null,
    openalex_field: topic.field?.display_name ?? null,
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
