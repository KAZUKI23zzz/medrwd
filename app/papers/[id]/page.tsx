import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuartileBadge } from "@/components/papers/QuartileBadge";
import { BackToPapersLink } from "@/components/papers/BackToPapersLink";
import { FavoriteButton } from "@/components/papers/FavoriteButton";
import { getPapers, getDatabases } from "@/lib/data-loader";
import { getRelatedPapers } from "@/lib/related-papers";
import { papersUrlForArea } from "@/lib/papers-url-state";

export function generateStaticParams() {
  const papers = getPapers();
  return papers.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // 本文（英語の title + abstract）の類似度で並べる。同じDBというだけの
  // 論文を並べていた頃は、DPC論文221件すべてで同じ5件が出ていた。
  // 関連度が閾値に届かない場合は5件に満たなくてよい。
  const related = getRelatedPapers(paper.id);

  // Match DB slugs for linking
  // DBページへのリンク。名前の部分一致だと似た名前のDBを取り違えるので、
  // 一覧・詳細ページと同じく paper_tag の完全一致で引く。
  const dbLinks = paper.databases_used.map((dbName) => {
    const db = databases.find((d) => d.paper_tag === dbName);
    return db ? { name: dbName, slug: db.slug } : { name: dbName, slug: null };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackToPapersLink />

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
            <FavoriteButton paperId={paper.id} className="ml-auto" />
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
                      ),
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
                  <div className="mt-1 flex flex-col gap-1">
                    {paper.additional_data_sources.map((src) => (
                      <span
                        key={src}
                        className="rounded-md border px-2 py-1 text-sm leading-snug text-foreground"
                      >
                        {src}
                      </span>
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

              {paper.openalex_subfield && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    診療領域
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Link href={papersUrlForArea(paper.openalex_subfield)}>
                      <Badge
                        variant="outline"
                        className="cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {paper.openalex_subfield}
                      </Badge>
                    </Link>
                    {/* 細かいトピック名。絞り込みの軸にするには種類が多すぎるので表示のみ */}
                    {paper.openalex_topic && (
                      <span className="text-xs text-muted-foreground">
                        {paper.openalex_topic}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(paper.analysis_methods ?? []).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    解析手法
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {paper.analysis_methods.map((method) => (
                      <Badge
                        key={method}
                        variant="secondary"
                        className="border-blue-200 bg-blue-50 text-blue-700"
                      >
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

          {paper.abstract_ja && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 font-semibold">AI要約</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {paper.abstract_ja}
                </p>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">Abstract</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {paper.abstract}
            </p>
          </div>
        </CardContent>
      </Card>

      {related.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">関連研究</h3>
          <div className="space-y-2">
            {related.map(({ paper: r }) => (
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
        </div>
      )}

      {/* ページが長いので、読み終わった位置にも戻る導線を置く */}
      <div className="border-t pt-4">
        <BackToPapersLink />
      </div>
    </div>
  );
}
