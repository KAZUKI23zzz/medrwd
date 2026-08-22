"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PaperCard } from "./PaperCard";
import { PaperFilterPanel } from "./PaperFilterPanel";
import { cn } from "@/lib/utils";
import {
  useFavorites,
  useFavoritesPersistenceFailed,
  pruneFavorites,
} from "@/lib/favorites";
import {
  parsePapersUrlState,
  buildPapersQuery,
  hasActiveFilters,
  countActiveFilters,
  EMPTY_PAPERS_STATE,
  type PapersUrlState,
  type SortOption,
  type ListFilterKey,
} from "@/lib/papers-url-state";
import {
  rememberPapersReturn,
  peekPapersReturn,
  clearPapersReturn,
} from "@/lib/papers-return";
import {
  buildSearchIndex,
  parseSearchQuery,
  matchesAllTerms,
} from "@/lib/papers-search";
import { computeFacetOptions, facetValuesOf } from "@/lib/papers-facets";
import type { Paper } from "@/types/paper";

interface PaperFiltersProps {
  papers: Paper[];
}

const ITEMS_PER_PAGE = 20;
/**
 * sticky ヘッダー(h-14 = 56px)の下に少し余白を足した位置。
 * サイドバーの貼り付き位置（下の lg:top-20）と同じ値にしておくこと。
 */
const HEADER_OFFSET = 80;
/** 入力中に URL を書き換え続けないための待ち時間 */
const INPUT_DEBOUNCE_MS = 300;
/** 詳細ページから戻ったときのスクロール位置復元を諦めるまでの時間 */
const RESTORE_TIMEOUT_MS = 1500;
/** 復元位置がこの時間ぶれなければ復元完了とみなす */
const RESTORE_HOLD_MS = 300;
/** 復元中の見張り間隔 */
const RESTORE_POLL_MS = 16;
/** ドロワーを閉じたあとのスクロール実行が取りこぼされた場合の保険 */
const DRAWER_CLOSE_FALLBACK_MS = 300;

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

  // モバイルの絞り込みドロワー。一時的な表示状態なので URL にも履歴にも積まない
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerOpenRef = useRef(false);
  /** ドロワーを開いている間に発生した「一覧の先頭へ」を、閉じたときにまとめて1回だけ実行する */
  const pendingScrollRef = useRef(false);

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
  const scrollToResultsTopNow = useCallback(() => {
    const el = resultsRef.current;
    if (!el) return;
    const target = Math.max(0, documentTop(el) - HEADER_OFFSET);
    if (window.scrollY <= target + 1) return;
    // スムーススクロールは環境によって無視されることがあるため即時移動にする
    window.scrollTo(0, target);
  }, []);

  /**
   * ドロワーを開いている間は背後が見えないため、その場では動かさず予約だけしておく。
   * ここで動かしてしまうと、ドロワーのスクロールロック解除時に位置が巻き戻る。
   */
  const scrollToResultsTop = useCallback(() => {
    if (drawerOpenRef.current) {
      pendingScrollRef.current = true;
      return;
    }
    scrollToResultsTopNow();
  }, [scrollToResultsTopNow]);

  /** 予約されていた「一覧の先頭へ」を実行する。二重に走っても害がないようフラグで潰す */
  const flushPendingScroll = useCallback(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    scrollToResultsTopNow();
  }, [scrollToResultsTopNow]);

  const handleDrawerOpenChange = useCallback(
    (open: boolean) => {
      drawerOpenRef.current = open;
      setDrawerOpen(open);
      // 閉じるアニメーションが無い/完了通知が来ない環境でも取りこぼさないための保険。
      // 先に onOpenChangeComplete が走っていればフラグは落ちているので二重実行にならない。
      if (!open)
        window.setTimeout(flushPendingScroll, DRAWER_CLOSE_FALLBACK_MS);
    },
    [flushPendingScroll],
  );

  // lg 以上ではドロワーを使わない。開いたまま画面幅が広がると
  // Dialog は modal のままなのに CSS(lg:hidden)で見えなくなり、
  // スクロールロックとフォーカストラップだけが残って画面が固まる。
  // （タブレットを縦から横に回したときに起きる）
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const closeIfDesktop = () => {
      if (mq.matches) handleDrawerOpenChange(false);
    };
    mq.addEventListener("change", closeIfDesktop);
    return () => mq.removeEventListener("change", closeIfDesktop);
  }, [handleDrawerOpenChange]);

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
    if (!saved) return;
    if (saved.url !== currentListUrl()) {
      // ヘッダーのナビ等、別経路で一覧に来た。古い控えを残すと
      // 後で開いた詳細ページの「戻る」が、見ていない絞り込みに飛んでしまう
      clearPapersReturn();
      return;
    }

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

  const years = useMemo(() => {
    const ys = papers.map((p) => p.year);
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [papers]);

  // 正規化済みの検索対象テキストを1度だけ作る（papers と同じ並び）
  const searchIndex = useMemo(() => buildSearchIndex(papers), [papers]);
  const searchTerms = useMemo(
    () => parseSearchQuery(state.search),
    [state.search],
  );

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

  // 条件ごとに「その条件だけ見たら通るか」を持っておく。
  // ここから、全条件を満たす一覧と、ファセットごとの件数の両方を組み立てる。
  /**
   * キーワード検索。0件になったら自動で条件を緩め、緩めたことを呼び出し側に返す。
   *
   * PubMed は 0件の画面をほぼ出さず、「元のクエリ」「実際に使ったクエリ」「その結果」
   * の3点を並べて見せる。ここでも同じ考え方で、
   *   1. どの論文にも無い語は落とす
   *   2. それでも0件なら、後ろの語から順に落とす
   * という順で緩める。緩めた事実は必ず画面に出す（黙って別の検索をしない）。
   */
  const searchOutcome = useMemo(() => {
    const passAll = () => papers.map(() => true);
    if (searchTerms.length === 0) {
      return { pass: passAll(), notFound: [], dropped: [] };
    }

    const passFor = (terms: string[]) =>
      searchIndex.map((h) => matchesAllTerms(h, terms));
    const any = (arr: boolean[]) => arr.some(Boolean);

    const full = passFor(searchTerms);
    if (any(full)) {
      return { pass: full, notFound: [], dropped: [] };
    }

    // 1. どの論文にも出てこない語を落とす
    const notFound = searchTerms.filter(
      (t) => !searchIndex.some((h) => h.includes(t)),
    );
    let kept = searchTerms.filter((t) => !notFound.includes(t));
    if (kept.length === 0) {
      return { pass: papers.map(() => false), notFound, dropped: [] };
    }
    let pass = passFor(kept);
    if (any(pass)) {
      return { pass, notFound, dropped: [] };
    }

    // 2. まだ0件なら、後ろの語から順に落とす
    const dropped: string[] = [];
    while (kept.length > 1) {
      dropped.unshift(kept[kept.length - 1]);
      kept = kept.slice(0, -1);
      pass = passFor(kept);
      if (any(pass)) {
        return { pass, notFound, dropped };
      }
    }
    return { pass: papers.map(() => false), notFound, dropped };
  }, [papers, searchIndex, searchTerms]);

  const passSearch = searchOutcome.pass;

  const favorites = useFavorites();
  const favoritesUnavailable = useFavoritesPersistenceFailed();
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  // 全件通過。お気に入りの絞り込みが「切」のときは常にこれを使うので、
  // 星を押しても下流（ファセット件数・並び替え）を計算し直さずに済む。
  const passAll = useMemo(() => papers.map(() => true), [papers]);

  // お気に入りは他の絞り込みと同じく AND の一条件。
  // ファセットの件数もこれを踏まえた数になる。
  const passFavorite = useMemo(
    () =>
      state.favoritesOnly ? papers.map((p) => favoriteIds.has(p.id)) : passAll,
    [papers, favoriteIds, state.favoritesOnly, passAll],
  );

  // 指摘: 週次同期で削除された論文のIDが残ると、件数が実態と合わなくなる。
  // 一覧を開いたときに、論文側に無いIDを取り除いておく。
  useEffect(() => {
    pruneFavorites(new Set(papers.map((p) => p.id)));
  }, [papers]);

  const passYear = useMemo(
    () =>
      papers.map(
        (p) =>
          (state.yearFrom === null || p.year >= state.yearFrom) &&
          (state.yearTo === null || p.year <= state.yearTo),
      ),
    [papers, state.yearFrom, state.yearTo],
  );

  const passFacet = useMemo(() => {
    const forKey = (key: ListFilterKey, selected: Set<string>) =>
      selected.size === 0
        ? papers.map(() => true)
        : papers.map((p) => facetValuesOf(p, key).some((v) => selected.has(v)));
    return {
      dbs: forKey("dbs", selectedDbs),
      designs: forKey("designs", selectedDesigns),
      categories: forKey("categories", selectedCategories),
      methods: forKey("methods", selectedMethods),
    };
  }, [
    papers,
    selectedDbs,
    selectedDesigns,
    selectedCategories,
    selectedMethods,
  ]);

  /** 指定ファセット「以外」の条件をすべて満たすか。ファセット件数の母集団になる */
  const passExcept = useCallback(
    (key: ListFilterKey) =>
      papers.map(
        (_, i) =>
          passSearch[i] &&
          passYear[i] &&
          passFavorite[i] &&
          (key === "dbs" || passFacet.dbs[i]) &&
          (key === "designs" || passFacet.designs[i]) &&
          (key === "categories" || passFacet.categories[i]) &&
          (key === "methods" || passFacet.methods[i]),
      ),
    [papers, passSearch, passYear, passFavorite, passFacet],
  );

  const facets = useMemo(
    () => ({
      dbs: computeFacetOptions(papers, "dbs", passExcept("dbs")),
      designs: computeFacetOptions(papers, "designs", passExcept("designs")),
      categories: computeFacetOptions(
        papers,
        "categories",
        passExcept("categories"),
      ),
      methods: computeFacetOptions(papers, "methods", passExcept("methods")),
    }),
    [papers, passExcept],
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

  /** 適用中の絞り込みをチップとして並べるための一覧 */
  const chips = useMemo(
    () => [
      ...state.dbs.map((value) => ({
        key: "dbs" as ListFilterKey,
        value,
        variant: "default" as const,
        className: "",
      })),
      ...state.designs.map((value) => ({
        key: "designs" as ListFilterKey,
        value,
        variant: "secondary" as const,
        className: "",
      })),
      ...state.categories.map((value) => ({
        key: "categories" as ListFilterKey,
        value,
        variant: "outline" as const,
        className: "",
      })),
      ...state.methods.map((value) => ({
        key: "methods" as ListFilterKey,
        value,
        variant: "secondary" as const,
        className: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
      })),
    ],
    [state.dbs, state.designs, state.categories, state.methods],
  );

  const clearSearch = useCallback(() => {
    setSearchInput("");
    applyState({ search: "", page: 1 });
    scrollToResultsTop();
  }, [applyState, scrollToResultsTop]);

  const toggleFavoritesOnly = useCallback(() => {
    applyState({ favoritesOnly: !stateRef.current.favoritesOnly, page: 1 });
    scrollToResultsTop();
  }, [applyState, scrollToResultsTop]);

  const clearYearRange = useCallback(() => {
    setYearFromInput("");
    setYearToInput("");
    applyState({ yearFrom: null, yearTo: null, page: 1 });
    scrollToResultsTop();
  }, [applyState, scrollToResultsTop]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setYearFromInput("");
    setYearToInput("");
    applyState({ ...EMPTY_PAPERS_STATE, sort: stateRef.current.sort });
    scrollToResultsTop();
  }, [applyState, scrollToResultsTop]);

  /** 検索欄。×で中身を消せるようにする（サイドバーとモバイルの2箇所で使う） */
  const searchBox = (className?: string) => (
    <div className={cn("relative", className)}>
      <Input
        placeholder="キーワード検索..."
        aria-label="キーワード検索"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className={searchInput ? "pr-8" : undefined}
      />
      {searchInput && (
        <button
          type="button"
          aria-label="検索キーワードを消す"
          onClick={clearSearch}
          className="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-2.5 after:content-[''] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );

  const goToPage = useCallback(
    (page: number) => {
      applyState({ page }, { push: true });
      scrollToResultsTop();
      // スクロールだけだと、キーボード/読み上げ利用者は画面外に残った
      // ページ送りボタンに立ったままになる。フォーカスも一覧の先頭へ移す。
      resultsRef.current?.focus({ preventScroll: true });
    },
    [applyState, scrollToResultsTop],
  );

  const filtered = useMemo(() => {
    const result = papers.filter(
      (_, i) =>
        passSearch[i] &&
        passYear[i] &&
        passFavorite[i] &&
        passFacet.dbs[i] &&
        passFacet.designs[i] &&
        passFacet.categories[i] &&
        passFacet.methods[i],
    );

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
  }, [papers, passSearch, passYear, passFavorite, passFacet, state.sort]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  // 共有された URL のページ番号が現在の絞り込みでは行き過ぎている場合に空振りしないよう丸める
  const currentPage = Math.min(state.page, Math.max(1, totalPages));
  const paginatedPapers = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const hasFilters = hasActiveFilters(state);
  const activeFilterCount = countActiveFilters(state);

  // サイドバーとドロワーで同じ入力部品を使う（ロジックの二重化を避けるため）
  const panelProps = {
    facets,
    selectedDbs,
    selectedDesigns,
    selectedCategories,
    selectedMethods,
    onToggle: toggleValue,
    years,
    yearFromInput,
    yearToInput,
    onYearFromChange: setYearFromInput,
    onYearToChange: setYearToInput,
    hasFilters,
    onClear: clearFilters,
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* デスクトップ: 常設サイドバー / モバイル: 下のドロワーへ */}
      {/*
        デスクトップでは絞り込みを画面に貼り付けておく。
        flex の子は既定で親の高さまで伸ばされ、そのままだと sticky が効かないので
        self-start で縮めている。中身は画面より高いので、はみ出す分はここでスクロールさせる。
        top はヘッダー(h-14=56px)＋余白。
      */}
      <aside className="hidden w-full shrink-0 space-y-6 lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-64 lg:self-start lg:overflow-y-auto lg:pr-2">
        {searchBox()}
        <PaperFilterPanel {...panelProps} />
      </aside>

      {/*
        モバイル: 絞り込みドロワー。modal 既定で focus trap・スクロールロック・Escape が付く。

        開閉アニメーションは意図的に付けていない。Base UI は transition の完了
        （transitionend）を待ってから閉じるため、ページが非表示のあいだは
        アニメーションが進まず、ドロワーが閉じないまま残り
        onOpenChangeComplete も呼ばれない。見栄えより確実に閉じることを優先する。

        加えて data-[closed]:hidden を付けている。Base UI は閉じた印
        （data-closed）を付けてから実際の unmount までに一拍あり、その判定も
        非表示ページでは進まないため、印が付いた時点で確実に見えなくする。
      */}
      <Dialog.Root
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        onOpenChangeComplete={(open) => {
          if (!open) flushPendingScroll();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 data-[closed]:hidden lg:hidden" />
          <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-background shadow-xl data-[closed]:hidden lg:hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Dialog.Title className="text-base font-semibold">
                絞り込み
              </Dialog.Title>
              <Dialog.Close
                aria-label="絞り込みを閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <PaperFilterPanel {...panelProps} />
            </div>

            <div className="border-t px-4 py-3">
              <Dialog.Close
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                {filtered.length} 件を表示
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Results */}
      <div
        ref={resultsRef}
        tabIndex={-1}
        className="flex-1 space-y-3 outline-none"
      >
        {/* モバイル: 検索はドロワーを開かずに使えるところに置く */}
        {searchBox("lg:hidden")}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => handleDrawerOpenChange(true)}
            >
              絞り込み
              {activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
            <Button
              variant={state.favoritesOnly ? "default" : "outline"}
              size="sm"
              aria-pressed={state.favoritesOnly}
              onClick={toggleFavoritesOnly}
            >
              <span aria-hidden="true">{state.favoritesOnly ? "★" : "☆"}</span>
              お気に入り
              {favorites.length > 0 && ` (${favorites.length})`}
            </Button>
            {/* 絞り込みで件数が変わったことを読み上げで伝える */}
            <p className="text-sm text-muted-foreground" role="status">
              {filtered.length} 件の研究
              {filtered.length !== papers.length && ` / 全 ${papers.length} 件`}
            </p>
          </div>

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

        {/* 適用中の絞り込み。PubMed 同様、結果の直上にも全解除を置く */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">絞り込み中:</span>

            {state.search && (
              <Badge
                render={<button type="button" />}
                variant="outline"
                className="cursor-pointer text-xs"
                aria-label={`キーワード「${state.search}」を解除`}
                onClick={clearSearch}
              >
                {state.search} <span aria-hidden="true">×</span>
              </Badge>
            )}

            {chips.map((chip) => (
              <Badge
                key={`${chip.key}:${chip.value}`}
                render={<button type="button" />}
                variant={chip.variant}
                className={cn("cursor-pointer text-xs", chip.className)}
                aria-label={`絞り込み「${chip.value}」を解除`}
                onClick={() => toggleValue(chip.key, chip.value)}
              >
                {chip.value} <span aria-hidden="true">×</span>
              </Badge>
            ))}

            {state.favoritesOnly && (
              <Badge
                render={<button type="button" />}
                variant="secondary"
                className="cursor-pointer border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100"
                aria-label="お気に入りのみの絞り込みを解除"
                onClick={toggleFavoritesOnly}
              >
                お気に入りのみ <span aria-hidden="true">×</span>
              </Badge>
            )}

            {(state.yearFrom !== null || state.yearTo !== null) && (
              <Badge
                render={<button type="button" />}
                variant="outline"
                className="cursor-pointer text-xs"
                aria-label="出版年の絞り込みを解除"
                onClick={clearYearRange}
              >
                {state.yearFrom ?? years.min}〜{state.yearTo ?? years.max}年{" "}
                <span aria-hidden="true">×</span>
              </Badge>
            )}

            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 rounded-sm text-xs text-blue-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              すべて解除
            </button>
          </div>
        )}

        {/* お気に入りが保存できない環境（プライベートモード等）では、その旨を断る */}
        {favoritesUnavailable && (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            このブラウザではお気に入りを保存できません（プライベートモードなど）。
            ページを閉じると失われます。
          </div>
        )}

        {/* 検索条件を自動で緩めたときは、何をしたかを必ず伝える */}
        {(searchOutcome.notFound.length > 0 ||
          searchOutcome.dropped.length > 0) && (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {searchOutcome.notFound.length > 0 && (
              <p>
                <strong>{searchOutcome.notFound.join("、")}</strong>{" "}
                に一致する研究はありませんでした。
              </p>
            )}
            {searchOutcome.dropped.length > 0 && (
              <p>
                すべての語を含む研究が無かったため、{" "}
                <strong>{searchOutcome.dropped.join("、")}</strong>{" "}
                を外して検索しています。
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {paginatedPapers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}

          {filtered.length === 0 &&
            state.favoritesOnly &&
            favorites.length === 0 && (
              <div className="space-y-3 py-12 text-center">
                <p className="font-medium">お気に入りはまだありません</p>
                <p className="text-sm text-muted-foreground">
                  各研究の <span aria-hidden="true">☆</span>{" "}
                  を押すと、ここに集まります。
                  <br />
                  保存先はこのブラウザの中だけです。端末をまたいでは共有されず、
                  ブラウザのデータを消すと失われます。
                </p>
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFavoritesOnly}
                  >
                    すべての研究を見る
                  </Button>
                </div>
              </div>
            )}

          {filtered.length === 0 &&
            !(state.favoritesOnly && favorites.length === 0) && (
              <div className="space-y-3 py-12 text-center">
                <p className="font-medium">
                  該当する研究が見つかりませんでした
                </p>
                <p className="text-sm text-muted-foreground">
                  キーワードを減らすか、絞り込みを外すと見つかることがあります。
                </p>
                {hasFilters && (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {state.search && (
                      <Button variant="outline" size="sm" onClick={clearSearch}>
                        キーワードを消す
                      </Button>
                    )}
                    {/* キーワード以外に絞り込みが掛かっていれば出す。
                        以前は chips（DB・デザイン等）だけを見ており、
                        出版年やお気に入りだけのときに逃げ道が消えていた。 */}
                    {activeFilterCount > (state.search ? 1 : 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        すべての絞り込みを解除
                      </Button>
                    )}
                  </div>
                )}
              </div>
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
