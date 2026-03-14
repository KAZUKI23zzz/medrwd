import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "医療RWD研究カタログ - 日本の医療リアルワールドデータ研究検索",
  description:
    "日本の医療リアルワールドデータ（RWD）を使った研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト",
};

const navItems = [
  { href: "/", label: "ダッシュボード" },
  { href: "/papers", label: "研究カタログ" },
  { href: "/databases", label: "DB一覧" },
  { href: "/news", label: "ニュース" },
  { href: "/about", label: "About" },
];

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
            <nav className="hidden gap-1 md:flex">
              {navItems.map((item) => (
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
          <div className="mx-auto max-w-7xl px-4">
            医療RWD研究カタログ - 日本の医療リアルワールドデータ研究検索
          </div>
        </footer>
      </body>
    </html>
  );
}
