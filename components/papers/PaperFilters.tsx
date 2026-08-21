"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperCard } from "./PaperCard";
import {
  parsePapersUrlState,
  buildPapersQuery,
  hasActiveFilters,
  EMPTY_PAPERS_STATE,
  type PapersUrlState,
  type SortOption,
} from "@/lib/papers-url-state";
import {
  rememberPapersReturn,
  peekPapersReturn,
  clearPapersReturn,
} from "@/lib/papers-return";
import type { Paper } from "@/types/paper";

interface PaperFiltersProps {
  papers: Paper[];
}

const ITEMS_PER_PAGE = 20;
/** sticky ヘッダー(h-14 = 56px)の下に少し余白を足した位置に送る */
const HEADER_OFFSET = 72;
/** 入力中に URL を書き換え続けないための待ち時間 */
const INPUT_DEBOUNCE_MS = 300;
/** 詳細ページから戻ったときのスクロール位置復元を諦めるまでの時間 */
const RESTORE_TIMEOUT_MS = 1500;
/** 復元位置がこの時間ぶれなければ復元完了とみなす */
const RESTORE_HOLD_MS = 300;
/** 復元中の見張り間隔 */
const RESTORE_POLL_MS = 16;

type ListFilterKey = "dbs" | "designs" | "categories" | "methods";

function currentListUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * 要素のドキュメント上端からの位置。
 *
 * `getBoundingClientRect().top + scrollY` でも同じ値になるが、あちらは
 * 現在のスクロール位置を巻き込むため、レイアウトが更新されていない場面で
 * ずれた値を返すことがある。offsetTop の積み上げはスクロール位置に依存しない。
 */
function documentTop(el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

export function PaperFilters({ papers }: PaperFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(
    () => parsePapersUrlState(searchParams),
    [searchParams],
  );

  // ハンドラを安定させるため、最新の state は ref 経由で読む。
  // router.replace 後に searchParams が届くまでには一拍あるので、
  // 続けざまにチェックを付けても取りこぼさないよう applyState 側で先に進めておく。
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const resultsRef = useRef<HTMLDivElement>(null);

  // 検索欄・出版年は打鍵のたびに URL を書き換えると履歴も描画も荒れるので、
  // ローカル state を正としてワンテンポ遅れて URL に反映する
  const [searchInput, setSearchInput] = useState(state.search);
  const [yearFromInput, setYearFromInput] = useState(
    state.yearFrom === null ? "" : String(state.yearFrom),
  );
  const [yearToInput, setYearToInput] = useState(
    state.yearTo === null ? "" : String(state.yearTo),
  );

  const applyState = useCallback(
    (patch: Partial<PapersUrlState>, opts?: { push?: boolean }) => {
      const next = { ...stateRef.current, ...patch };
      stateRef.current = next;
      const qs = buildPapersQuery(next);
      const url = qs ? `${pathname}?${qs}` : pathname;
      // スクロールは自前で制御するので Next 側の自動スクロールは切る
      if (opts?.push) {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [pathname, router],
  );

  /**
   * 一覧の先頭までスクロールで送り返す。
   * すでに一覧の先頭より上にいる場合は動かさない（勝手に下へ送られると鬱陶しいため）。
   */
  const scrollToResultsTop = useCallback(() => {
    const el = resultsRef.current;
    if (!el) return;
    const target = Math.max(0, documentTop(el) - HEADER_OFFSET);
    if (window.scrollY <= target + 1) return;
    // スムーススクロールは環境によって無視されることがあるため即時移動にする
    window.scrollTo(0, target);
  }, []);

  // 戻る/進むで URL が巻き戻ったときだけ、ローカル入力を URL 側に合わせ直す。
  // 自分の router.replace では popstate は飛ばないので、
  // 入力途中の文字が確定前に書き戻される心配がない。
  useEffect(() => {
    const syncInputsFromLocation = () => {
      const restored = parsePapersUrlState(
        new URLSearchParams(window.location.search),
      );
      setSearchInput(restored.search);
      setYearFromInput(
        restored.yearFrom === null ? "" : String(restored.yearFrom),
      );
      setYearToInput(restored.yearTo === null ? "" : String(restored.yearTo));
    };
    window.addEventListener("popstate", syncInputsFromLocation);
    return () => window.removeEventListener("popstate", syncInputsFromLocation);
  }, []);

  // 検索欄 → URL（遅延反映）
  useEffect(() => {
    if (searchInput === state.search) return;
    const timer = setTimeout(() => {
      applyState({ search: searchInput, page: 1 });
      scrollToResultsTop();
    }, INPUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, state.search, applyState, scrollToResultsTop]);

  // 出版年 → URL（遅延反映。空欄は「制限なし」）
  useEffect(() => {
    const parse = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") return null;
      const n = Number.parseInt(trimmed, 10);
      return Number.isFinite(n) ? n : null;
    };
    const nextFrom = parse(yearFromInput);
    const nextTo = parse(yearToInput);
    if (nextFrom === state.yearFrom && nextTo === state.yearTo) return;
    const timer = setTimeout(() => {
      applyState({ yearFrom: nextFrom, yearTo: nextTo, page: 1 });
      scrollToResultsTop();
    }, INPUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    yearFromInput,
    yearToInput,
    state.yearFrom,
    state.yearTo,
    applyState,
    scrollToResultsTop,
  ]);

  // 詳細ページから戻ってきたときにスクロール位置を復元する。
  //
  // 戻った直後は一覧がまだ組み上がっておらず目的の位置まで伸びていないうえ、
  // Next 側の「遷移したら先頭へ」も後から走ってくる。そのため
  //   1. 一覧が目的の位置まで伸びるのを待つ
  //   2. 復元後もしばらく、位置が保たれているか見張る
  // という形で粘り、ユーザーが自分でスクロールし始めたら即座に手を引く。
  //
  // requestAnimationFrame はタブが非表示のあいだ一切発火せず、
  // 「別タブで開いて後から戻る」と復元も後始末も行われないまま残るため、
  // 非表示でも動く setTimeout で回している。
  useEffect(() => {
    const saved = peekPapersReturn();
    if (!saved || saved.url !== currentListUrl()) return;

    let cancelled = false;
    let timer = 0;
    let heldSince: number | null = null;
    const deadline = performance.now() + RESTORE_TIMEOUT_MS;
    const abort = () => {
      cancelled = true;
    };

    const restore = () => {
      if (cancelled) return;
      const now = performance.now();
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= saved.scrollY) {
        if (Math.abs(window.scrollY - saved.scrollY) > 1) {
          // Next 側の「遷移したら先頭へ」が後から走っても押し戻す
          window.scrollTo(0, saved.scrollY);
          heldSince = null;
        } else {
          heldSince ??= now;
          if (now - heldSince >= RESTORE_HOLD_MS) {
            clearPapersReturn();
            return; // 位置が安定したので完了
          }
        }
      }
      if (now < deadline) {
        timer = window.setTimeout(restore, RESTORE_POLL_MS);
      } else {
        clearPapersReturn();
      }
    };

    // ユーザーが自分で操作し始めたら復元をやめる
    window.addEventListener("wheel", abort, { passive: true, once: true });
    window.addEventListener("touchstart", abort, { passive: true, once: true });
    window.addEventListener("keydown", abort, { once: true });
    restore();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("wheel", abort);
      window.removeEventListener("touchstart", abort);
      window.removeEventListener("keydown", abort);
    };
  }, []);

  // 論文詳細へ抜ける直前に「一覧のどこを見ていたか」を控える。
  //
  // React の onClick を親側に置くと Next の <Link> が先に遷移してしまい呼ばれないため、
  // キャプチャ段階のネイティブリスナーで、リンク自身のハンドラより先に押さえる。
  useEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.('a[href^="/papers/"]')) return;
      rememberPapersReturn(currentListUrl(), window.scrollY);
    };
    el.addEventListener("click", onClickCapture, { capture: true });
    return () =>
      el.removeEventListener("click", onClickCapture, { capture: true });
  }, []);

  // Extract unique filter values
  const allDbs = useMemo(() => {
    const dbs = new Map<string, number>();
    for (const p of papers) {
      for (const db of p.databases_used) {
        dbs.set(db, (dbs.get(db) || 0) + 1);
      }
    }
    return [...dbs.entries()].sort((a, b) => b[1] - a[1]);
  }, [papers]);

  const allDesigns = useMemo(() => {
    const designs = new Map<string, number>();
    for (const p of papers) {
      designs.set(p.study_design, (designs.get(p.study_design) || 0) + 1);
    }
    return [...designs.entries()].sort((a, b) => b[1] - a[1]);
  }, [papers]);

  const allCategories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const p of papers) {
      for (const cat of p.research_categories ?? []) {
        cats.set(cat, (cats.get(cat) || 0) + 1);
      }
    }
    return [...cats.entries()].sort((a, b) => b[1] - a[1]);
  }, [papers]);

  const allMethods = useMemo(() => {
    const methods = new Map<string, number>();
    for (const p of papers) {
      for (const method of p.analysis_methods ?? []) {
        methods.set(method, (methods.get(method) || 0) + 1);
      }
    }
    return [...methods.entries()].sort((a, b) => b[1] - a[1]);
  }, [papers]);

  const years = useMemo(() => {
    const ys = papers.map((p) => p.year);
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [papers]);

  const selectedDbs = useMemo(() => new Set(state.dbs), [state.dbs]);
  const selectedDesigns = useMemo(
    () => new Set(state.designs),
    [state.designs],
  );
  const selectedCategories = useMemo(
    () => new Set(state.categories),
    [state.categories],
  );
  const selectedMethods = useMemo(
    () => new Set(state.methods),
    [state.methods],
  );

  const toggleValue = useCallback(
    (key: ListFilterKey, value: string) => {
      const current = stateRef.current[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      applyState({ [key]: next, page: 1 });
      scrollToResultsTop();
    },
    [applyState, scrollToResultsTop],
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setYearFromInput("");
    setYearToInput("");
    applyState({ ...EMPTY_PAPERS_STATE, sort: stateRef.current.sort });
    scrollToResultsTop();
  }, [applyState, scrollToResultsTop]);

  const goToPage = useCallback(
    (page: number) => {
      applyState({ page }, { push: true });
      scrollToResultsTop();
    },
    [applyState, scrollToResultsTop],
  );

  const filtered = useMemo(() => {
    const result = papers.filter((p) => {
      // Text search
      if (state.search) {
        const q = state.search.toLowerCase();
        const haystack =
          `${p.title} ${p.title_ja ?? ""} ${p.abstract} ${p.abstract_ja ?? ""} ${p.authors.join(" ")} ${p.journal} ${p.databases_used.join(" ")} ${p.study_design} ${(p.research_categories ?? []).join(" ")} ${(p.analysis_methods ?? []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // DB filter
      if (selectedDbs.size > 0) {
        if (!p.databases_used.some((db) => selectedDbs.has(db))) return false;
      }

      // Design filter
      if (selectedDesigns.size > 0) {
        if (!selectedDesigns.has(p.study_design)) return false;
      }

      // Category filter
      if (selectedCategories.size > 0) {
        if (
          !(p.research_categories ?? []).some((cat) =>
            selectedCategories.has(cat),
          )
        )
          return false;
      }

      // Analysis methods filter
      if (selectedMethods.size > 0) {
        if (!(p.analysis_methods ?? []).some((m) => selectedMethods.has(m)))
          return false;
      }

      // Year filter（未指定側は制限なし）
      if (state.yearFrom !== null && p.year < state.yearFrom) return false;
      if (state.yearTo !== null && p.year > state.yearTo) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (state.sort) {
        case "newest":
          return b.publication_date.localeCompare(a.publication_date);
        case "oldest":
          return a.publication_date.localeCompare(b.publication_date);
        case "if-desc":
          return (b.impact_factor ?? 0) - (a.impact_factor ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [
    papers,
    state.search,
    state.yearFrom,
    state.yearTo,
    state.sort,
    selectedDbs,
    selectedDesigns,
    selectedCategories,
    selectedMethods,
  ]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  // 共有された URL のページ番号が現在の絞り込みでは行き過ぎている場合に空振りしないよう丸める
  const currentPage = Math.min(state.page, Math.max(1, totalPages));
  const paginatedPapers = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const hasFilters = hasActiveFilters(state);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Filters sidebar */}
      <aside className="w-full shrink-0 space-y-6 lg:w-64">
        <div>
          <Input
            placeholder="キーワード検索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">使用データベース</h3>
          <div className="space-y-1.5">
            {allDbs.map(([db, count]) => (
              <label
                key={db}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={selectedDbs.has(db)}
                  onCheckedChange={() => toggleValue("dbs", db)}
                />
                <span className="text-sm">{db}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">研究デザイン</h3>
          <div className="space-y-1.5">
            {allDesigns.map(([design, count]) => (
              <label
                key={design}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={selectedDesigns.has(design)}
                  onCheckedChange={() => toggleValue("designs", design)}
                />
                <span className="text-sm">{design}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">研究カテゴリ</h3>
          <div className="space-y-1.5">
            {allCategories.map(([cat, count]) => (
              <label
                key={cat}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={selectedCategories.has(cat)}
                  onCheckedChange={() => toggleValue("categories", cat)}
                />
                <span className="text-sm">{cat}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">解析手法</h3>
          <div className="space-y-1.5">
            {allMethods.map(([method, count]) => (
              <label
                key={method}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={selectedMethods.has(method)}
                  onCheckedChange={() => toggleValue("methods", method)}
                />
                <span className="text-sm">{method}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">出版年</h3>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={years.min}
              max={years.max}
              placeholder={String(years.min)}
              aria-label="出版年の下限"
              value={yearFromInput}
              onChange={(e) => setYearFromInput(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">-</span>
            <Input
              type="number"
              min={years.min}
              max={years.max}
              placeholder={String(years.max)}
              aria-label="出版年の上限"
              value={yearToInput}
              onChange={(e) => setYearToInput(e.target.value)}
              className="w-20"
            />
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:underline"
          >
            フィルタをクリア
          </button>
        )}
      </aside>

      {/* Results */}
      <div ref={resultsRef} className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} 件の研究
            {filtered.length !== papers.length && ` / 全 ${papers.length} 件`}
          </p>

          <div className="flex items-center gap-2">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="papers-sort"
            >
              並び替え:
            </label>
            <select
              id="papers-sort"
              value={state.sort}
              onChange={(e) => {
                applyState({ sort: e.target.value as SortOption, page: 1 });
                scrollToResultsTop();
              }}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="if-desc">IF高い順</option>
            </select>
          </div>
        </div>

        {/* Active filter tags */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1">
            {state.dbs.map((db) => (
              <Badge
                key={db}
                variant="default"
                className="cursor-pointer text-xs"
                onClick={() => toggleValue("dbs", db)}
              >
                {db} ×
              </Badge>
            ))}
            {state.designs.map((d) => (
              <Badge
                key={d}
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => toggleValue("designs", d)}
              >
                {d} ×
              </Badge>
            ))}
            {state.categories.map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => toggleValue("categories", cat)}
              >
                {cat} ×
              </Badge>
            ))}
            {state.methods.map((m) => (
              <Badge
                key={m}
                variant="secondary"
                className="cursor-pointer text-xs border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                onClick={() => toggleValue("methods", m)}
              >
                {m} ×
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {paginatedPapers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              該当する研究が見つかりませんでした
            </p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              前へ
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show first, last, current, and adjacent pages
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .reduce<(number | "...")[]>((acc, page, idx, arr) => {
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-sm text-muted-foreground"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant={currentPage === item ? "default" : "outline"}
                      size="sm"
                      className="min-w-[2rem]"
                      aria-current={currentPage === item ? "page" : undefined}
                      onClick={() => goToPage(item as number)}
                    >
                      {item}
                    </Button>
                  ),
                )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              次へ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
