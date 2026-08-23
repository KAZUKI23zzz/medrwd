import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QuartileBadge } from "./QuartileBadge";
import { FavoriteButton } from "./FavoriteButton";
import type { Paper } from "@/types/paper";

export function PaperCard({ paper }: { paper: Paper }) {
  const authorDisplay =
    paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(", ")}, et al.`
      : paper.authors.join(", ");

  return (
    // カード全体を押せるようにするが、リンクを入れ子にはしない。
    // タイトルの <a> に擬似要素を敷いてカード全体を覆う（stretched link）。
    // DOI/PubMed は外部リンクなので、その上に出るよう z-10 で持ち上げている。
    <Card className="relative transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring/50">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {paper.sjr_quartile && (
            <QuartileBadge quartile={paper.sjr_quartile} />
          )}
          {paper.impact_factor && (
            <Badge
              variant="secondary"
              className="text-xs"
              title="OpenAlex 2yr Mean Citedness"
            >
              CI: {paper.impact_factor}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{paper.year}</span>
          {/* カード全体を覆うリンクより上に出す（FavoriteButton 側で z-10 を持つ） */}
          <FavoriteButton paperId={paper.id} className="ml-auto -my-1" />
        </div>

        <Link
          href={`/papers/${paper.id}`}
          className="block font-medium leading-snug hover:text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {paper.title}
        </Link>
        {paper.title_ja && (
          <p className="text-[13px] text-muted-foreground leading-snug">
            {paper.title_ja}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {authorDisplay} - {paper.journal}
        </p>

        <div className="space-y-1.5">
          {paper.databases_used.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                DB:
              </span>
              {paper.databases_used.map((db) => (
                <Badge key={db} variant="default" className="text-xs">
                  {db}
                </Badge>
              ))}
            </div>
          )}

          {paper.additional_data_sources.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                追加データ:
              </span>
              {paper.additional_data_sources.map((src) => (
                <span
                  key={src}
                  className="rounded-md border px-2 py-0.5 text-xs leading-snug text-foreground"
                >
                  {src}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              デザイン:
            </span>
            <Badge variant="secondary" className="text-xs">
              {paper.study_design}
            </Badge>
          </div>

          {(paper.research_categories ?? []).length > 0 &&
            paper.research_categories[0] !== "その他" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  カテゴリ:
                </span>
                {paper.research_categories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}

          {paper.openalex_subfield && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                診療領域:
              </span>
              <Badge
                variant="outline"
                className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                {paper.openalex_subfield}
              </Badge>
            </div>
          )}

          {(paper.analysis_methods ?? []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                解析手法:
              </span>
              {paper.analysis_methods.map((method) => (
                <Badge
                  key={method}
                  variant="secondary"
                  className="text-xs border-blue-200 bg-blue-50 text-blue-700"
                >
                  {method}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="relative z-10 flex w-fit gap-3 pt-1 text-xs">
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              DOI
            </a>
          )}
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pubmed_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            PubMed
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
