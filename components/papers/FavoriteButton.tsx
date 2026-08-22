"use client";

import { useFavorites, toggleFavorite } from "@/lib/favorites";
import { cn } from "@/lib/utils";

/**
 * お気に入りの星。
 *
 * カード内では、カード全体を覆うリンク（stretched link）の擬似要素より上に出す必要がある。
 * 下の z-10 がそれを担っていて、これが無いとカードのリンクに吸われて詳細ページへ飛ぶ。
 * ボタンはリンクの内側ではないので、遷移を止める処理は要らない。
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
      onClick={() => toggleFavorite(paperId)}
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
