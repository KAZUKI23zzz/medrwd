"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { peekPapersReturn } from "@/lib/papers-return";

const FALLBACK_HREF = "/papers";

/** sessionStorage は読み取り時点の値がすべてなので購読は不要 */
const subscribe = () => () => {};
const getServerSnapshot = () => FALLBACK_HREF;
const getSnapshot = () => peekPapersReturn()?.url ?? FALLBACK_HREF;

/**
 * 研究カタログへ戻るリンク。
 *
 * 一覧から来た場合は、そのときの絞り込み・ページ番号を含む URL に戻す。
 * 検索エンジンやトップページなど一覧以外から直接来た場合は素の `/papers` に戻す。
 * 行き先はブラウザ側にしか無い情報なので、静的HTMLでは `/papers` を出しておき
 * ハイドレーション後に差し替える。
 */
export function BackToPapersLink() {
  const href = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <Link
      href={href}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      ← 研究カタログに戻る
    </Link>
  );
}
