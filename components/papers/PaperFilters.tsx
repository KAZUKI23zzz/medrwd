"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperCard } from "./PaperCard";
import type { Paper } from "@/types/paper";

interface PaperFiltersProps {
  papers: Paper[];
}

type SortOption = "newest" | "oldest" | "if-desc";

const ITEMS_PER_PAGE = 20;

export function PaperFilters({ papers }: PaperFiltersProps) {
  const [search, setSearch] = useState("");
  const [selectedDbs, setSelectedDbs] = useState<Set<string>>(new Set());
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(
    new Set()
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(
    new Set()
  );
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2030]);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);

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

  const toggleSet = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Set<string>>>,
      value: string
    ) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          next.delete(value);
        } else {
          next.add(value);
        }
        return next;
      });
      setCurrentPage(1);
    },
    []
  );

  const filtered = useMemo(() => {
    const result = papers.filter((p) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
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
        if (!selectedDesigns.has(p.study_design))
          return false;
      }

      // Category filter
      if (selectedCategories.size > 0) {
        if (!(p.research_categories ?? []).some((cat) => selectedCategories.has(cat)))
          return false;
      }

      // Analysis methods filter
      if (selectedMethods.size > 0) {
        if (!(p.analysis_methods ?? []).some((m) => selectedMethods.has(m)))
          return false;
      }

      // Year filter
      if (p.year < yearRange[0] || p.year > yearRange[1]) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
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
  }, [papers, search, selectedDbs, selectedDesigns, selectedCategories, selectedMethods, yearRange, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedPapers = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const hasFilters = selectedDbs.size > 0 || selectedDesigns.size > 0 || selectedCategories.size > 0 || selectedMethods.size > 0 || search;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Filters sidebar */}
      <aside className="w-full shrink-0 space-y-6 lg:w-64">
        <div>
          <Input
            placeholder="キーワード検索..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">使用データベース</h3>
          <div className="space-y-1.5">
            {allDbs.map(([db, count]) => (
              <label key={db} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={selectedDbs.has(db)}
                  onCheckedChange={() => toggleSet(setSelectedDbs, db)}
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
                  onCheckedChange={() => toggleSet(setSelectedDesigns, design)}
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
                  onCheckedChange={() => toggleSet(setSelectedCategories, cat)}
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
                  onCheckedChange={() => toggleSet(setSelectedMethods, method)}
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
              value={yearRange[0]}
              onChange={(e) => {
                setYearRange([parseInt(e.target.value) || years.min, yearRange[1]]);
                setCurrentPage(1);
              }}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">-</span>
            <Input
              type="number"
              min={years.min}
              max={years.max}
              value={yearRange[1]}
              onChange={(e) => {
                setYearRange([yearRange[0], parseInt(e.target.value) || years.max]);
                setCurrentPage(1);
              }}
              className="w-20"
            />
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setSelectedDbs(new Set());
              setSelectedDesigns(new Set());
              setSelectedCategories(new Set());
              setSelectedMethods(new Set());
              setSearch("");
              setYearRange([years.min, years.max]);
              setCurrentPage(1);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            フィルタをクリア
          </button>
        )}
      </aside>

      {/* Results */}
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} 件の研究
            {filtered.length !== papers.length && ` / 全 ${papers.length} 件`}
          </p>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">並び替え:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                setCurrentPage(1);
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
            {[...selectedDbs].map((db) => (
              <Badge
                key={db}
                variant="default"
                className="cursor-pointer text-xs"
                onClick={() => toggleSet(setSelectedDbs, db)}
              >
                {db} ×
              </Badge>
            ))}
            {[...selectedDesigns].map((d) => (
              <Badge
                key={d}
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => toggleSet(setSelectedDesigns, d)}
              >
                {d} ×
              </Badge>
            ))}
            {[...selectedCategories].map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => toggleSet(setSelectedCategories, cat)}
              >
                {cat} ×
              </Badge>
            ))}
            {[...selectedMethods].map((m) => (
              <Badge
                key={m}
                variant="secondary"
                className="cursor-pointer text-xs border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                onClick={() => toggleSet(setSelectedMethods, m)}
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
              onClick={() => setCurrentPage((p) => p - 1)}
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
                    <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant={currentPage === item ? "default" : "outline"}
                      size="sm"
                      className="min-w-[2rem]"
                      onClick={() => setCurrentPage(item as number)}
                    >
                      {item}
                    </Button>
                  )
                )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              次へ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
