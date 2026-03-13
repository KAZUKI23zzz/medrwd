import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QuartileBadge } from "./QuartileBadge";
import type { Paper } from "@/types/paper";

export function PaperCard({ paper }: { paper: Paper }) {
  const authorDisplay =
    paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(", ")}, et al.`
      : paper.authors.join(", ");

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {paper.sjr_quartile && (
            <QuartileBadge quartile={paper.sjr_quartile} />
          )}
          {paper.impact_factor && (
            <Badge variant="secondary" className="text-xs">
              IF: {paper.impact_factor}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{paper.year}</span>
        </div>

        <Link
          href={`/papers/${paper.id}`}
          className="block font-medium leading-snug hover:text-primary"
        >
          {paper.title}
        </Link>

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
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                追加データ:
              </span>
              {paper.additional_data_sources.map((src) => (
                <Badge key={src} variant="outline" className="text-xs">
                  {src}
                </Badge>
              ))}
            </div>
          )}

          {paper.study_design && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                デザイン:
              </span>
              <Badge variant="secondary" className="text-xs">
                {paper.study_design}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1 text-xs">
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
