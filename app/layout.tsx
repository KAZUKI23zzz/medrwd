import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";
import { NAV_ITEMS } from "@/lib/nav-items";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// デプロイ個別のURL（medrwd-<hash>-...）は不変かつ後で404になるため、恒久エイリアスを使う
const siteUrl = "https://medrwd.vercel.app";

export const metadata: Metadata = {
  title: "医療RWD研究カタログ - 日本の医療リアルワールドデータ研究検索",
  description:
    "日本の医療リアルワールドデータ（RWD）を使った研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト",
  openGraph: {
    title: "医療RWD研究カタログ",
    description:
      "日本の医療RWD研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト",
    url: siteUrl,
    siteName: "医療RWD研究カタログ",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "医療RWD研究カタログ",
    description:
      "日本の医療RWD研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="relative mx-auto flex h-14 max-w-7xl items-center px-4">
            <Link href="/" className="mr-8 text-lg font-bold">
              医療RWD研究カタログ
            </Link>
            <nav aria-label="メインメニュー" className="hidden gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <MobileNav />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4">
            <span>
              医療RWD研究カタログ - 日本の医療リアルワールドデータ研究検索
            </span>
            <Link
              href="/status"
              className="hover:text-foreground hover:underline"
            >
              同期ステータス
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
