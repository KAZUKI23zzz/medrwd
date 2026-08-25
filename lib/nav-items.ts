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
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ダッシュボード" },
  { href: "/papers", label: "研究カタログ" },
  { href: "/databases", label: "DB一覧" },
  { href: "/about", label: "About" },
];
