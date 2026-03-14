import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PaperCard } from "@/components/papers/PaperCard";
import { getDatabases, getPapers } from "@/lib/data-loader";

export function generateStaticParams() {
  const databases = getDatabases();
  return databases.map((db) => ({ slug: db.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const databases = getDatabases();
  const db = databases.find((d) => d.slug === slug);
  if (!db) return { title: "Not Found" };
  return {
    title: `${db.name} - 医療RWD研究カタログ`,
    description: `${db.name}の特徴・アクセス方法と、このDBを使った研究一覧`,
  };
}

export default async function DatabaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const databases = getDatabases();
  const papers = getPapers();
  const db = databases.find((d) => d.slug === slug);

  if (!db) {
    notFound();
  }

  // Find papers using this DB
  const dbPapers = papers.filter((p) =>
    p.databases_used.some(
      (dbName) =>
        dbName.toLowerCase().includes(db.slug) ||
        db.name.includes(dbName) ||
        db.name_en.includes(dbName)
    )
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/databases"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← データベース一覧に戻る
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant={db.type === "public" ? "default" : "secondary"}>
              {db.type === "public" ? "公的" : "商業"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {db.administrator}
            </span>
          </div>
          <CardTitle className="text-xl">{db.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{db.name_en}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                データ種別
              </p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {db.data_types.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                対象規模
              </p>
              <p className="mt-1 text-sm">{db.coverage}</p>
              <p className="text-sm text-muted-foreground">
                データ開始: {db.data_start}年〜
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">
              アクセス方法
            </p>
            <p className="mt-1 text-sm">{db.access}</p>
            {db.access_url && (
              <a
                href={db.access_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                詳細 →
              </a>
            )}
            {db.publications_url && (
              <a
                href={db.publications_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-sm text-blue-600 hover:underline"
              >
                公式論文一覧 →
              </a>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-green-700">強み</p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {db.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-orange-700">限界</p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {db.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>

          {db.linkable_with.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                連結可能なDB
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {db.linkable_with.map((linked) => (
                  <Badge key={linked} variant="outline">
                    {linked}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground">
              向いている研究
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {db.best_for.map((use) => (
                <Badge key={use} variant="secondary">
                  {use}
                </Badge>
              ))}
            </div>
          </div>

          {db.related_resources && db.related_resources.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                関連リソース
              </p>
              <div className="mt-1 space-y-1">
                {db.related_resources.map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:underline"
                  >
                    {r.label} →
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          このDBを使った研究（{dbPapers.length}件）
        </h2>
        {dbPapers.length > 0 ? (
          <div className="space-y-3">
            {dbPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            このDBを使った研究はまだ登録されていません
          </p>
        )}
      </div>
    </div>
  );
}
