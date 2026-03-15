"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PaperCard } from "./PaperCard";
import type { Paper } from "@/types/paper";

interface PaperFiltersProps {
  papers: Paper[];
}

export function PaperFilters({ papers }: PaperFiltersProps) {
  const [search, setSearch] = useState("");
  const [selectedDbs, setSelectedDbs] = useState<Set<string>>(new Set());
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(
    new Set()
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2030]);

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
    },
    []
  );

  const filtered = useMemo(() => {
    return papers.filter((p) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const haystack =
          `${p.title} ${p.title_ja ?? ""} ${p.abstract} ${p.abstract_ja ?? ""} ${p.authors.join(" ")} ${p.journal} ${p.databases_used.join(" ")} ${p.study_design} ${(p.research_categories ?? []).join(" ")}`.toLowerCase();
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

      // Year filter
      if (p.year < yearRange[0] || p.year > yearRange[1]) return false;

      return true;
    });
  }, [papers, search, selectedDbs, selectedDesigns, selectedCategories, yearRange]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Filters sidebar */}
      <aside className="w-full shrink-0 space-y-6 lg:w-64">
        <div>
          <Input
            placeholder="キーワード検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <h3 className="mb-2 text-sm font-semibold">出版年</h3>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={years.min}
              max={years.max}
              value={yearRange[0]}
              onChange={(e) =>
                setYearRange([parseInt(e.target.value) || years.min, yearRange[1]])
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">-</span>
            <Input
              type="number"
              min={years.min}
              max={years.max}
              value={yearRange[1]}
              onChange={(e) =>
                setYearRange([yearRange[0], parseInt(e.target.value) || years.max])
              }
              className="w-20"
            />
          </div>
        </div>

        {(selectedDbs.size > 0 || selectedDesigns.size > 0 || selectedCategories.size > 0 || search) && (
          <button
            onClick={() => {
              setSelectedDbs(new Set());
              setSelectedDesigns(new Set());
              setSelectedCategories(new Set());
              setSearch("");
              setYearRange([years.min, years.max]);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            フィルタをクリア
          </button>
        )}
      </aside>

      {/* Results */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} 件の研究
            {filtered.length !== papers.length && ` / 全 ${papers.length} 件`}
          </p>
          <div className="flex flex-wrap gap-1">
            {[...selectedDbs].map((db) => (
              <Badge
                key={db}
                variant="default"
                className="cursor-pointer text-xs"
                onClick={() => toggleSet(setSelectedDbs, db)}
              >
                {db} x
              </Badge>
            ))}
            {[...selectedDesigns].map((d) => (
              <Badge
                key={d}
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => toggleSet(setSelectedDesigns, d)}
              >
                {d} x
              </Badge>
            ))}
            {[...selectedCategories].map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => toggleSet(setSelectedCategories, cat)}
              >
                {cat} x
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              該当する研究が見つかりませんでした
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
