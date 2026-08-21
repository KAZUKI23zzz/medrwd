"use client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { ListFilterKey } from "@/lib/papers-url-state";

export interface PaperFilterPanelProps {
  allDbs: [string, number][];
  allDesigns: [string, number][];
  allCategories: [string, number][];
  allMethods: [string, number][];
  selectedDbs: Set<string>;
  selectedDesigns: Set<string>;
  selectedCategories: Set<string>;
  selectedMethods: Set<string>;
  onToggle: (key: ListFilterKey, value: string) => void;
  years: { min: number; max: number };
  yearFromInput: string;
  yearToInput: string;
  onYearFromChange: (value: string) => void;
  onYearToChange: (value: string) => void;
  hasFilters: boolean;
  onClear: () => void;
}

interface CheckboxGroupProps {
  title: string;
  entries: [string, number][];
  selected: Set<string>;
  filterKey: ListFilterKey;
  onToggle: (key: ListFilterKey, value: string) => void;
}

function CheckboxGroup({
  title,
  entries,
  selected,
  filterKey,
  onToggle,
}: CheckboxGroupProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="space-y-1.5">
        {entries.map(([value, count]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 py-0.5"
          >
            <Checkbox
              checked={selected.has(value)}
              onCheckedChange={() => onToggle(filterKey, value)}
            />
            <span className="text-sm">{value}</span>
            <span className="text-xs text-muted-foreground">({count})</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * 絞り込み条件の入力部分。
 *
 * デスクトップでは左のサイドバー、モバイルではドロワーの中身として
 * 同じものを使う。キーワード検索だけはモバイルでもドロワーを開かずに
 * 使えるようにしたいので、ここには含めず呼び出し側で配置している。
 */
export function PaperFilterPanel({
  allDbs,
  allDesigns,
  allCategories,
  allMethods,
  selectedDbs,
  selectedDesigns,
  selectedCategories,
  selectedMethods,
  onToggle,
  years,
  yearFromInput,
  yearToInput,
  onYearFromChange,
  onYearToChange,
  hasFilters,
  onClear,
}: PaperFilterPanelProps) {
  return (
    <div className="space-y-6">
      <CheckboxGroup
        title="使用データベース"
        entries={allDbs}
        selected={selectedDbs}
        filterKey="dbs"
        onToggle={onToggle}
      />
      <CheckboxGroup
        title="研究デザイン"
        entries={allDesigns}
        selected={selectedDesigns}
        filterKey="designs"
        onToggle={onToggle}
      />
      <CheckboxGroup
        title="研究カテゴリ"
        entries={allCategories}
        selected={selectedCategories}
        filterKey="categories"
        onToggle={onToggle}
      />
      <CheckboxGroup
        title="解析手法"
        entries={allMethods}
        selected={selectedMethods}
        filterKey="methods"
        onToggle={onToggle}
      />

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
            onChange={(e) => onYearFromChange(e.target.value)}
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
            onChange={(e) => onYearToChange(e.target.value)}
            className="w-20"
          />
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={onClear}
          className="text-sm text-blue-600 hover:underline"
        >
          フィルタをクリア
        </button>
      )}
    </div>
  );
}
