"use client";

import { useState } from "react";
import Link from "next/link";

const navItems = [
  { href: "/", label: "ダッシュボード" },
  { href: "/papers", label: "研究カタログ" },
  { href: "/databases", label: "DB一覧" },
  { href: "/news", label: "ニュース" },
  { href: "/about", label: "About" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="メニュー"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="16" x2="20" y2="16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <nav className="absolute left-0 top-14 z-50 w-full border-b bg-background p-4 shadow-lg md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
