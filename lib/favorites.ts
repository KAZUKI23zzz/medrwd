"use client";

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

import { useSyncExternalStore } from "react";

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
/**
 * localStorage に書けなかったか。
 * プライベートブラウジングや容量超過では setItem が例外を投げる。
 * 黙って握り潰すと「星は付いたのに次に開いたら消えている」ことになるので、
 * 画面で断れるようにここで覚えておく。
 */
let persistenceFailed = false;

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
    // 書けなくても、この画面を開いている間は操作できるようにする。
    // ただし保存されていないことは画面で伝える
    persistenceFailed = true;
  }
  notify();
}

/** 保存できていない状態か（画面で断るために使う） */
export function getPersistenceFailedSnapshot(): boolean {
  return persistenceFailed;
}

function getPersistenceFailedServerSnapshot(): boolean {
  return false;
}

/**
 * 論文側に無いIDを取り除く。
 *
 * 週次の同期で偽陽性の論文が削除されるため、放っておくと
 * 「お気に入り (5)」と出るのに4件しか表示されない、という食い違いが起きる。
 */
export function pruneFavorites(existingIds: ReadonlySet<string>): void {
  const current = getFavoritesSnapshot();
  const kept = current.filter((id) => existingIds.has(id));
  if (kept.length === current.length) return;

  cache = kept.length > 0 ? Object.freeze(kept) : EMPTY;
  try {
    if (kept.length > 0) {
      localStorage.setItem(KEY, JSON.stringify(kept));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // 掃除できなくても表示は正しくなるので、ここでは何もしない
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

/** 同じ画面に並ぶ星と件数表示を、購読でまとめて更新する */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot,
  );
}

/** 保存できていないときに画面で断るためのフック */
export function useFavoritesPersistenceFailed(): boolean {
  return useSyncExternalStore(
    subscribeFavorites,
    getPersistenceFailedSnapshot,
    getPersistenceFailedServerSnapshot,
  );
}
