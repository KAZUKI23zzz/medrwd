import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuartileBadge } from "@/components/papers/QuartileBadge";
import { getPapers, getDatabases } from "@/lib/data-loader";
import type { Paper } from "@/types/paper";

export function generateStaticParams() {
  const papers = getPapers();
  return papers.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const papers = getPapers();
  const paper = papers.find((p) => p.id === id);
  if (!paper) return { title: "Not Found" };
  return {
    title: `${paper.title.slice(0, 60)}... - 医療RWD研究カタログ`,
    description: paper.abstract.slice(0, 160),
  };
}

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const papers = getPapers();
  const databases = getDatabases();
  const paper = papers.find((p) => p.id === id);

  if (!paper) {
    notFound();
  }

  // Find related papers (same DB used)
  const related = papers
    .filter(
      (p) =>
        p.id !== paper.id &&
        p.databases_used.some((db) => paper.databases_used.includes(db))
    )
    .slice(0, 5);

  // Match DB slugs for linking
  const dbLinks = paper.databases_used
    .map((dbName) => {
      const db = databases.find(
        (d) =>
          d.name.includes(dbName) ||
          d.name_en.includes(dbName) ||
          dbName === d.slug.toUpperCase()
      );
      return db ? { name: dbName, slug: db.slug } : { name: dbName, slug: null };
    });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/papers"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← 研究カタログに戻る
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {paper.sjr_quartile && (
              <QuartileBadge quartile={paper.sjr_quartile} />
            )}
            {paper.impact_factor && (
              <Badge variant="secondary" title="OpenAlex 2yr Mean Citedness">
                CI: {paper.impact_factor}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{paper.year}</span>
          </div>
          <CardTitle className="text-xl leading-snug">{paper.title}</CardTitle>
          {paper.title_ja && (
            <p className="text-[15px] text-muted-foreground leading-snug">
              {paper.title_ja}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {paper.authors.join(", ")}
          </p>
          <p className="text-sm font-medium">{paper.journal}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 text-sm">
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                DOI: {paper.doi}
              </a>
            )}
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pubmed_id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              PubMed: {paper.pubmed_id}
            </a>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">研究アプローチ</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  使用データベース
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {dbLinks.length > 0 ? (
                    dbLinks.map((db) =>
                      db.slug ? (
                        <Link key={db.name} href={`/databases/${db.slug}`}>
                          <Badge variant="default" className="cursor-pointer">
                            {db.name}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge key={db.name} variant="default">
                          {db.name}
                        </Badge>
                      )
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      未検出
                    </span>
                  )}
                </div>
              </div>

              {paper.additional_data_sources.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    追加データソース
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {paper.additional_data_sources.map((src) => (
                      <Badge key={src} variant="outline">
                        {src}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  研究デザイン
                </p>
                <Badge variant="secondary" className="mt-1">
                  {paper.study_design}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  研究カテゴリ
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(paper.research_categories ?? []).map((cat) => (
                    <Badge key={cat} variant="outline">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>

              {(paper.analysis_methods ?? []).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    解析手法
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {paper.analysis_methods.map((method) => (
                      <Badge key={method} variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                        {method}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {paper.mesh_terms.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    MeSH Terms
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {paper.mesh_terms.map((term) => (
                      <Badge key={term} variant="outline" className="text-xs">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">Abstract</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {paper.abstract}
            </p>
            {paper.abstract_ja && (
              <>
                <h3 className="mb-2 mt-4 font-semibold text-muted-foreground">
                  日本語訳
                </h3>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {paper.abstract_ja}
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {related.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">
            同じDBを使った関連研究
          </h3>
          <div className="space-y-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/papers/${r.id}`}
                className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium">{r.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.databases_used.map((db) => (
                    <Badge key={db} variant="default" className="text-xs">
                      {db}
                    </Badge>
                  ))}
                  <Badge variant="secondary" className="text-xs">
                    {r.study_design}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
