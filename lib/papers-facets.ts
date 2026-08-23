/**
 * 絞り込み条件（ファセット）の選択肢と件数。
 *
 * 件数は「そのファセット以外の条件をすべて適用した結果」に対して数える。
 * ファセット検索の一般的な作法で、こうしないと自分自身の選択で件数が
 * 潰れてしまい、同じファセット内の別の値を選べなくなる。
 *
 * 並び順は絞り込み前の件数で固定する。件数に合わせて並べ替えると、
 * チェックを付けるたびに選択肢が動いて非常に押しにくくなるため。
 */

import type { Paper } from "@/types/paper";
import type { ListFilterKey } from "./papers-url-state";

export interface FacetOption {
  value: string;
  /** 現在の絞り込みでの件数。0 ならその選択肢を選んでも0件になる */
  count: number;
}

/** その論文が持つ、指定ファセットの値 */
export function facetValuesOf(paper: Paper, key: ListFilterKey): string[] {
  switch (key) {
    case "dbs":
      return paper.databases_used;
    case "designs":
      return paper.study_design ? [paper.study_design] : [];
    case "categories":
      return paper.research_categories ?? [];
    case "methods":
      return paper.analysis_methods ?? [];
    case "areas":
      return paper.openalex_subfield ? [paper.openalex_subfield] : [];
  }
}

/**
 * ファセットの選択肢を組み立てる。
 *
 * @param passOthers そのファセット以外の条件をすべて満たすか。papers と同じ並び
 */
export function computeFacetOptions(
  papers: Paper[],
  key: ListFilterKey,
  passOthers: boolean[],
): FacetOption[] {
  const total = new Map<string, number>();
  const current = new Map<string, number>();

  papers.forEach((paper, i) => {
    const passes = passOthers[i];
    for (const value of facetValuesOf(paper, key)) {
      total.set(value, (total.get(value) ?? 0) + 1);
      if (passes) current.set(value, (current.get(value) ?? 0) + 1);
    }
  });

  // 並び順は絞り込み前の件数で決める（件数に追随させると選択肢が動いてしまう）
  return [...total.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => ({ value, count: current.get(value) ?? 0 }));
}
