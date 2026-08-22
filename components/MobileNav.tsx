"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const navItems = [
  { href: "/", label: "ダッシュボード" },
  { href: "/papers", label: "研究カタログ" },
  { href: "/databases", label: "DB一覧" },
  { href: "/about", label: "About" },
];

const MENU_ID = "mobile-nav-menu";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // 開いている間だけ、外側のタップと Escape で閉じられるようにする。
  // 以前は「✕を押す」「項目を選ぶ」の2通りしか閉じる方法がなく、
  // 多くのサイトで閉じられる外側タップが効かないので戸惑わせていた。
  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (navRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return; // ボタンは自身のトグルに任せる
      setOpen(false);
    };

    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // キーボードで閉じたときは、開いたボタンに戻しておく
      buttonRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="メニュー"
        aria-expanded={open}
        aria-controls={MENU_ID}
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
          aria-hidden="true"
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
        <nav
          ref={navRef}
          id={MENU_ID}
          aria-label="メインメニュー"
          className="absolute left-0 top-14 z-50 w-full border-b bg-background p-4 shadow-lg md:hidden"
        >
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
