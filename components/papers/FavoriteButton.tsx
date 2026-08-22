"use client";

import { useSyncExternalStore } from "react";
import {
  subscribeFavorites,
  getFavoritesSnapshot,
  getFavoritesServerSnapshot,
  toggleFavorite,
} from "@/lib/favorites";
import { cn } from "@/lib/utils";

/** 同じ画面に並ぶボタンと件数表示を、まとめて更新するための購読 */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot,
  );
}

/**
 * お気に入りの星。
 *
 * カード内では、カード全体を覆っているリンク（stretched link）より上に出す必要があるので
 * 呼び出し側で z-10 を持つ入れ物に置くこと。押しても詳細ページには飛ばない。
 */
export function FavoriteButton({
  paperId,
  className,
}: {
  paperId: string;
  className?: string;
}) {
  const favorites = useFavorites();
  const isFavorite = favorites.includes(paperId);

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
      title={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
      onClick={(e) => {
        // カード全体がリンクなので、押しても遷移させない
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(paperId);
      }}
      className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg leading-none transition-colors",
        "after:absolute after:-inset-1.5 after:content-['']",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        isFavorite
          ? "text-amber-500 hover:bg-amber-50"
          : "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
    </button>
  );
}
