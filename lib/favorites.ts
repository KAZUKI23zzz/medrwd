/**
 * お気に入り論文の保存。
 *
 * アカウント登録を必要としないよう、ブラウザの localStorage にID一覧を持つだけにしている。
 * サーバもDBも使わないので、メールアドレス等の個人情報は一切預からない。
 *
 * 制約（画面上でも断っている）:
 *  - ブラウザ・端末ごとに独立。PCで付けたものはスマホには出ない
 *  - ブラウザのデータを消すと失われる。プライベートウィンドウでは残らない
 *  - iOS Safari は、7日間サイトを訪れないと自動的に削除することがある
 *
 * React からは useSyncExternalStore で読む。localStorage は React の外にある状態なので、
 * 同じ画面に並ぶ複数のボタンと件数表示を、購読でまとめて更新する。
 */

const KEY = "medrwd:favorites";

/** サーバ描画時と、まだ読めていないときの値。毎回同じ参照を返す必要がある */
const EMPTY: readonly string[] = Object.freeze([]);

/**
 * 直近の値。useSyncExternalStore は getSnapshot が同じ内容なら
 * 同じ参照を返すことを求めるため、毎回 JSON.parse せずここに持つ。
 */
let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();
let watchingOtherTabs = false;

function readFromStorage(): readonly string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter((v): v is string => typeof v === "string");
    return ids.length > 0 ? Object.freeze(ids) : EMPTY;
  } catch {
    // プライベートモードや壊れた値でも、機能が落ちるだけで済ませる
    return EMPTY;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** 他のタブで変更されたら、こちらの表示も追随させる */
function watchOtherTabs(): void {
  if (watchingOtherTabs) return;
  watchingOtherTabs = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== KEY) return;
    cache = null;
    notify();
  });
}

export function subscribeFavorites(listener: () => void): () => void {
  watchOtherTabs();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFavoritesSnapshot(): readonly string[] {
  cache ??= readFromStorage();
  return cache;
}

/** 静的HTMLの生成時は空。ハイドレーション後に本当の値へ差し替わる */
export function getFavoritesServerSnapshot(): readonly string[] {
  return EMPTY;
}

/** 追加・解除。追加したものは後ろに積むので、付けた順が保たれる */
export function toggleFavorite(paperId: string): void {
  const current = getFavoritesSnapshot();
  const next = current.includes(paperId)
    ? current.filter((id) => id !== paperId)
    : [...current, paperId];

  cache = next.length > 0 ? Object.freeze(next) : EMPTY;
  try {
    if (next.length > 0) {
      localStorage.setItem(KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // 書けなくても、この画面が閉じるまでは操作できるようにしておく
  }
  notify();
}

/** すべて解除 */
export function clearFavorites(): void {
  cache = EMPTY;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
  notify();
}
