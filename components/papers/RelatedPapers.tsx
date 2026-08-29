"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * 画面に出す件数。フィルタで足りなくなってよい。
 *
 * **lib/related-papers.ts から import しないこと。** あちらは data-loader 経由で
 * data/papers.json を読むので、クライアントから触るとバンドルに 4.1MB の
 * papers.json 全体が載る（実際に一度やって計測した）。定数はここに置く。
 */
const RELATED_VISIBLE = 5;

/** 絞り込みの種類。値が違うもの同士は AND、同じ種類の中は OR で効く */
export type RelatedFilterKey = "areas" | "topics" | "dbs";

/** 1件ぶんの選択肢。件数はここでは持たず、選択状態に応じて描画時に数える */
export interface RelatedFilterOption {
  value: string;
  /** 画面に出す名前。トピックだけ value（ID）と表示名が違う */
  label: string;
}

/** 詳細ページに渡す候補1件。表示に要るものと、照合に要るものだけ */
export interface RelatedCandidate {
  id: string;
  title: string;
  title_ja: string | null;
  databases_used: string[];
  research_categories: string[];
  study_design: string;
  clinical_areas: string[];
  topic_ids: string[];
}

export interface RelatedPapersProps {
  candidates: RelatedCandidate[];
  /** その論文自身が持つ値から作った選択肢。空の種類は渡さない */
  filters: Record<RelatedFilterKey, RelatedFilterOption[]>;
}

const GROUP_LABEL: Record<RelatedFilterKey, string> = {
  areas: "診療分野",
  topics: "トピック",
  dbs: "データベース",
};

/** 候補が、その種類の選択値のどれかに当てはまるか */
function matches(
  candidate: RelatedCandidate,
  key: RelatedFilterKey,
  selected: Set<string>,
): boolean {
  if (selected.size === 0) return true; // 未選択の種類は素通し
  const values =
    key === "areas"
      ? candidate.clinical_areas
      : key === "topics"
        ? candidate.topic_ids
        : candidate.databases_used;
  return values.some((v) => selected.has(v));
}

/**
 * 詳細ページの「関連研究」。
 *
 * 並び順はスコア順のまま動かさない。利用者は絞り込むだけで、順番は変えられない。
 * 「同じDBの研究が並ぶ」ことは、そればかりが並ぶと邪魔だが、DPCで他にどんな研究が
 * あるかを見たい人にとっては目的そのもの。順序を1つに決めきらず、軸を開いている。
 *
 * 絞り込みの作法は研究カタログ（/papers）と同じで、種類が違うもの同士は AND、
 * 同じ種類の中は OR。利用者が2つの流儀を覚えなくて済むようにしている。
 *
 * 状態は URL に載せない。詳細ページの中だけで完結する一時的な操作で、
 * 共有したいのは論文そのものの URL だから。
 *
 * 件数は「その種類以外の条件をすべて適用した結果」に対して数える。研究カタログ
 * （lib/papers-facets.ts）と同じファセット検索の作法。静的な件数にすると、
 * 精神科(2)とJMDC(6)を両方選んで0件、のような行き止まりが起きる。
 */
export function RelatedPapers({ candidates, filters }: RelatedPapersProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<RelatedFilterKey, Set<string>>>({
    areas: new Set(),
    topics: new Set(),
    dbs: new Set(),
  });

  const keys = useMemo(
    () =>
      (Object.keys(GROUP_LABEL) as RelatedFilterKey[]).filter(
        (k) => filters[k].length > 0,
      ),
    [filters],
  );

  const visible = useMemo(() => {
    const hit = candidates.filter((c) =>
      keys.every((k) => matches(c, k, selected[k])),
    );
    return hit.slice(0, RELATED_VISIBLE);
  }, [candidates, keys, selected]);

  /**
   * 選択肢ごとの件数。自分の種類の選択は外して数えるので、同じ種類の中で
   * 別の値へ乗り換えられる（自分自身で数えると、選んだ瞬間に他が0になる）。
   */
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const key of keys) {
      const others = keys.filter((k) => k !== key);
      const pool = candidates.filter((c) =>
        others.every((k) => matches(c, k, selected[k])),
      );
      for (const option of filters[key]) {
        out[`${key}:${option.value}`] = pool.filter((c) =>
          matches(c, key, new Set([option.value])),
        ).length;
      }
    }
    return out;
  }, [candidates, keys, filters, selected]);

  const activeCount = keys.reduce((n, k) => n + selected[k].size, 0);

  const toggle = (key: RelatedFilterKey, value: string) =>
    setSelected((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });

  const clear = () =>
    setSelected({ areas: new Set(), topics: new Set(), dbs: new Set() });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">関連研究</h3>
        {keys.length > 0 && (
          <Button
            type="button"
            variant={activeCount > 0 ? "secondary" : "outline"}
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            フィルタ{activeCount > 0 ? `（${activeCount}）` : ""}
          </Button>
        )}
      </div>

      {open && keys.length > 0 && (
        <div className="mb-3 space-y-3 rounded-md border p-3">
          {keys.map((key) => (
            <div key={key}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {GROUP_LABEL[key]}
              </p>
              <div className="space-y-1.5">
                {filters[key].map((option) => {
                  const checked = selected[key].has(option.value);
                  const count = counts[`${key}:${option.value}`] ?? 0;
                  // 0件の選択肢は押しても何も起きないので無効にする。
                  // ただし選択済みなら外せるよう有効のままにする。
                  const disabled = count === 0 && !checked;
                  return (
                    <label
                      key={option.value}
                      className={`flex items-start gap-2 text-sm leading-snug ${
                        disabled
                          ? "cursor-not-allowed text-muted-foreground/50"
                          : "cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggle(key, option.value)}
                        className="mt-0.5 shrink-0"
                      />
                      <span>
                        {option.label}
                        <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                          ({count})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {activeCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              条件をクリア
            </Button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          この条件に当てはまる関連研究はありません。
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <Link
              key={r.id}
              href={`/papers/${r.id}`}
              className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
            >
              {/* 一覧のカード(PaperCard)と同じく英語タイトルが主、日本語が副 */}
              <p className="text-sm font-medium leading-snug">{r.title}</p>
              {r.title_ja && (
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  {r.title_ja}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.databases_used.map((db) => (
                  <Badge key={db} variant="default" className="text-xs">
                    {db}
                  </Badge>
                ))}
                {r.research_categories.map((category) => (
                  <Badge key={category} variant="outline" className="text-xs">
                    {category}
                  </Badge>
                ))}
                <Badge variant="secondary" className="text-xs">
                  {r.study_design}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
