"use client";

import { useSyncExternalStore } from "react";

/** 週次のはずが、これ以上更新が無ければ異常とみなす */
const STALE_DAYS = 10;

/** 時刻は購読先を持たないので、変更通知は不要 */
const subscribe = () => () => {};

/**
 * ページを開いた時刻。`getSnapshot` は同じ値を返し続けないと再レンダリングが
 * 止まらないので、モジュールに1つだけ持つ（`lib/favorites.ts` の `cache ??=` と同じ理由）。
 */
let openedAt: number | null = null;
const getClientNow = () => (openedAt ??= Date.now());

/** サーバ（＝静的エクスポートのビルド時）では測らない。理由は下記 */
const getServerNow = () => null;

/**
 * 最終同期からの経過日数を、**閲覧者の時計で**測って警告する。
 *
 * サーバ側で測ってはいけない。`Date.now()` がビルド時刻に焼き込まれるためで、
 * ビルドが走るのは Routine が push したときだけ、しかもその Routine が直前に
 * `last_run` を書いている。つまり経過日数は常にほぼ0になり、
 * **「Routine が完全に止まった」という、この警告が唯一必要な場面では絶対に出ない**
 * （止まればビルドも走らないので、警告が false だった日のHTMLを配り続ける）。
 *
 * 閲覧者のブラウザで測れば、ビルドが何ヶ月止まっていても日数は伸びる。
 * `useSyncExternalStore` にサーバ用スナップショットを持たせているのは、
 * サーバとクライアントで結果が食い違ってもハイドレーションが壊れないようにするため。
 */
export function StaleWarning({ lastRun }: { lastRun: string }) {
  const now = useSyncExternalStore(subscribe, getClientNow, getServerNow);

  const lastRunAt = new Date(lastRun).getTime();
  if (now === null || Number.isNaN(lastRunAt)) return null;

  const days = Math.floor((now - lastRunAt) / (24 * 60 * 60 * 1000));
  if (days <= STALE_DAYS) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-700">
      最終同期から{days}日更新がありません。Routineが停止している可能性があります。
    </div>
  );
}
