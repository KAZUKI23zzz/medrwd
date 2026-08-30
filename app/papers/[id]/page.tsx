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
import {
  RelatedPapers,
  type RelatedCandidate,
  type RelatedFilterKey,
  type RelatedFilterOption,
} from "@/components/papers/RelatedPapers";
import { papersUrlForArea } from "@/lib/papers-url-state";
import { clinicalAreasOf, AREA_SCORE_THRESHOLD } from "@/lib/clinical-areas";

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
  // 画面に出すのは5件だが、絞り込めるよう候補は多めに渡す（lib/related-papers.ts）。
  const related = getRelatedPapers(paper.id);

  // 診療分野は OpenAlex のトピックから辞書で引く（lib/clinical-areas.ts）
  const clinicalAreas = clinicalAreasOf(paper.openalex_topics);
  // トピックは第2・第3も含めて全件出す。診療分野に落ちなかった論文でも、
  // 何を根拠にそう判断したのかが読み手に見えるようにするため。
  const topics = paper.openalex_topics ?? [];

  // 関連研究の絞り込みは「この論文が持っている値」だけを選択肢にする。
  // 候補側にしか無い値まで並べると、選ぶ意味のない条件が増える。
  // 件数と0件の無効化はクライアント側で選択状態に応じて計算する
  // （components/papers/RelatedPapers.tsx）。
  const candidates: RelatedCandidate[] = related.map((r) => ({
    id: r.paper.id,
    title: r.paper.title,
    title_ja: r.paper.title_ja ?? null,
    databases_used: r.paper.databases_used,
    research_categories: r.paper.research_categories ?? [],
    study_design: r.paper.study_design,
    clinical_areas: r.clinical_areas,
    topic_ids: r.topic_ids,
  }));
  const relatedFilters: Record<RelatedFilterKey, RelatedFilterOption[]> = {
    areas: clinicalAreas.map((area) => ({ value: area, label: area })),
    // 絞り込みに使うトピックは候補側と同じ閾値でそろえる。付随的なトピックまで
    // 選択肢にすると、絞ったのに主題の違う論文が並ぶ
    topics: topics
      .filter((t) => t.score >= AREA_SCORE_THRESHOLD)
      .map((t) => ({ value: t.id, label: t.name })),
    dbs: paper.databases_used.map((db) => ({ value: db, label: db })),
  };

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
            {/* 0 は「値が無い」ではない。scripts/openalex.ts のコメント参照 */}
            {paper.impact_factor != null && (
              <Badge variant="secondary" title="OpenAlex 2yr Mean Citedness">
                CI: {paper.impact_factor}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{paper.entrez_year}</span>
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

              {clinicalAreas.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    診療分野
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {clinicalAreas.map((area) => (
                      <Link key={area} href={papersUrlForArea(area)}>
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          {area}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 診療分野の根拠。分野は自前の辞書で決めているのに対し、こちらは
                  OpenAlex がそのまま付けた値なので、見出しで出所を分けている。
                  絞り込みの軸にするには 679種と多すぎるので表示だけ。
                  関連度を並べて出すのは、第2・第3に 0.001 のようなトピックが
                  混ざるため。数字が無いと第1と同じ重みに見えてしまう。 */}
              {topics.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    トピック（OpenAlex）
                  </p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {topics.map((topic) => (
                      <span
                        key={topic.name}
                        className="text-xs text-muted-foreground"
                      >
                        {topic.name}
                        <span className="ml-1.5 tabular-nums opacity-70">
                          {topic.score.toFixed(3)}
                        </span>
                      </span>
                    ))}
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

      {candidates.length > 0 && (
        <RelatedPapers candidates={candidates} filters={relatedFilters} />
      )}

      {/* ページが長いので、読み終わった位置にも戻る導線を置く */}
      <div className="border-t pt-4">
        <BackToPapersLink />
      </div>
    </div>
  );
}
