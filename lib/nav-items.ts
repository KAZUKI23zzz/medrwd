/**
 * ヘッダーのナビゲーション項目。
 *
 * デスクトップ（app/layout.tsx）とモバイル（components/MobileNav.tsx）で
 * 同じものを出すので、ここ1箇所に置く。以前は両方に同じ配列が書かれており、
 * ページを増やすときに片方だけ直す事故が起きる形になっていた。
 *
 * サーバコンポーネント（layout）とクライアントコンポーネント（MobileNav）の
 * 両方から読むため、"use client" は付けない。
 */
export interface NavItem {
  href: string;
  label: string;
  /**
   * `<Link>` の先読みを止めるか。
   *
   * `/papers` は全論文の抄録を積んでいて1本で3.6MBある（CLAUDE.md 既知の課題2）。
   * Next.js はヘッダーのリンクを見えた時点で先読みするので、**このリンクが
   * 全ページにある＝どのページを開いても3.6MB余計に落ちてくる**。
   * 実測でトップ5.39MB・DB一覧5.45MB・論文詳細5.37MB、`/papers` 自身に至っては
   * 自分のHTML 3.77MB に加えて自分の先読み4.45MBで9.02MB落としていた。
   *
   * 先読みをやめると遷移の瞬間に取りに行くことになるが、落とす量は同じ1回分で、
   * それ以外の全ページが軽くなる。`/databases`・`/about` は数十KBなので触らない。
   */
  prefetch?: false;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ダッシュボード" },
  { href: "/papers", label: "研究カタログ", prefetch: false },
  { href: "/databases", label: "DB一覧" },
  { href: "/about", label: "About" },
];
