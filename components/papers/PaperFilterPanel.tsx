"use client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { ListFilterKey } from "@/lib/papers-url-state";
import type { FacetOption } from "@/lib/papers-facets";

export interface PaperFilterPanelProps {
  facets: Record<"dbs" | "designs" | "categories" | "methods", FacetOption[]>;
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
  options: FacetOption[];
  selected: Set<string>;
  filterKey: ListFilterKey;
  onToggle: (key: ListFilterKey, value: string) => void;
}

function CheckboxGroup({
  title,
  options,
  selected,
  filterKey,
  onToggle,
}: CheckboxGroupProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="space-y-1.5">
        {options.map(({ value, count }) => {
          const isSelected = selected.has(value);
          // 選ぶと0件になる選択肢は行き止まりなので選べなくする。
          // ただし選択済みのものは、解除できないと詰むので常に操作可能にする。
          const disabled = count === 0 && !isSelected;
          return (
            <label
              key={value}
              className={
                disabled
                  ? "flex items-center gap-2 py-0.5 opacity-40"
                  : "flex cursor-pointer items-center gap-2 py-0.5"
              }
            >
              <Checkbox
                checked={isSelected}
                disabled={disabled}
                onCheckedChange={() => onToggle(filterKey, value)}
              />
              <span className="text-sm">{value}</span>
              <span className="text-xs text-muted-foreground">({count})</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 絞り込み条件の入力部分。
 *
 * デスクトップでは左のサイドバー、モバイルではドロワーの中身として同じものを使う。
 * キーワード検索だけはモバイルでもドロワーを開かずに使えるようにしたいので、
 * ここには含めず呼び出し側で配置している。
 *
 * 各項目の件数は「他の条件を適用したうえでの件数」なので、絞り込むたびに変わる。
 * 並び順は絞り込み前の件数で固定してあり、動かない。
 */
export function PaperFilterPanel({
  facets,
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
        options={facets.dbs}
        selected={selectedDbs}
        filterKey="dbs"
        onToggle={onToggle}
      />
      <CheckboxGroup
        title="研究デザイン"
        options={facets.designs}
        selected={selectedDesigns}
        filterKey="designs"
        onToggle={onToggle}
      />
      <CheckboxGroup
        title="研究カテゴリ"
        options={facets.categories}
        selected={selectedCategories}
        filterKey="categories"
        onToggle={onToggle}
      />
      <CheckboxGroup
        title="解析手法"
        options={facets.methods}
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
          すべての絞り込みを解除
        </button>
      )}
    </div>
  );
}
