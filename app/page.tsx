import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaperCard } from "@/components/papers/PaperCard";
import { NewsItemCard } from "@/components/news/NewsItem";
import {
  getPapers,
  getDatabases,
  getNews,
  getCommercialLinks,
} from "@/lib/data-loader";

export default function Home() {
  const papers = getPapers();
  const databases = getDatabases();
  const news = getNews();
  const commercialLinks = getCommercialLinks();

  // Recent papers (top 5)
  const recentPapers = papers.slice(0, 5);

  // DB usage counts
  const dbCounts = new Map<string, number>();
  for (const p of papers) {
    for (const db of p.databases_used) {
      dbCounts.set(db, (dbCounts.get(db) || 0) + 1);
    }
  }
  const sortedDbCounts = [...dbCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Study design counts
  const designCounts = new Map<string, number>();
  for (const p of papers) {
    if (p.study_design) {
      designCounts.set(
        p.study_design,
        (designCounts.get(p.study_design) || 0) + 1
      );
    }
  }
  const sortedDesignCounts = [...designCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  // Recent news (top 5)
  const recentNews = news.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">MedRWD Japan</h1>
        <p className="text-lg text-muted-foreground">
          日本の医療リアルワールドデータを使った研究を
          <br />
          <strong>「どのDBで・どんな手法で・何を調べたか」</strong>
          で検索できるカタログ
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/papers"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            研究カタログを見る
          </Link>
          <Link
            href="/databases"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            データベース一覧
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              収録論文数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{papers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              対応データベース
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{databases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              DB検出率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {papers.length > 0
                ? Math.round(
                    (papers.filter((p) => p.databases_used.length > 0).length /
                      papers.length) *
                      100
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DB usage chart (text-based) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">データベース別の研究数</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedDbCounts.map(([db, count]) => {
              const maxCount = sortedDbCounts[0][1];
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={db} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm font-medium">
                    {db}
                  </span>
                  <div className="flex-1">
                    <div
                      className="h-6 rounded bg-primary/20"
                      style={{ width: `${pct}%` }}
                    >
                      <div className="flex h-full items-center px-2 text-xs font-medium">
                        {count}件
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent papers */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">最近追加された研究</h2>
            <Link
              href="/papers"
              className="text-sm text-blue-600 hover:underline"
            >
              すべて見る →
            </Link>
          </div>
          <div className="space-y-3">
            {recentPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        </div>

        {/* Sidebar: designs + news + commercial links */}
        <div className="space-y-6">
          {/* Study designs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">研究デザイン別</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sortedDesignCounts.map(([design, count]) => (
                  <Badge key={design} variant="secondary" className="text-sm">
                    {design}
                    <span className="ml-1 text-muted-foreground">({count})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Commercial DB links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">商業DB各社の論文一覧</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {commercialLinks.map((link) => (
                <a
                  key={link.company}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-md border p-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">{link.company}</span>
                  <span className="text-blue-600">→</span>
                </a>
              ))}
            </CardContent>
          </Card>

          {/* Recent news */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">最新ニュース</h2>
              <Link
                href="/news"
                className="text-sm text-blue-600 hover:underline"
              >
                すべて見る →
              </Link>
            </div>
            {recentNews.length > 0 ? (
              <div className="space-y-2">
                {recentNews.map((item) => (
                  <NewsItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                ニュースは近日追加予定です
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
