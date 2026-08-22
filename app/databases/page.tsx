import { getDatabases, getPapers, getPrivateDbLinks } from "@/lib/data-loader";
import { DatabaseCard } from "@/components/databases/DatabaseCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DATABASE_TYPE_LABEL,
  DATABASE_TYPE_DESCRIPTION,
} from "@/types/database";

export const metadata = {
  title: "データベース一覧 - 医療RWD研究カタログ",
  description:
    "日本の医療RWDデータベースを公的・民間別に一覧。特徴や向いている研究を比較",
};

export default function DatabasesPage() {
  const databases = getDatabases();
  const papers = getPapers();
  const privateDbLinks = getPrivateDbLinks();

  const publicDbs = databases.filter((db) => db.type === "public");
  const privateDbs = databases.filter((db) => db.type === "private");

  // DBごとの研究数。カタログの絞り込みと同じ基準（paper_tag の完全一致）で数えるので、
  // トップページ・DB一覧・DB詳細・研究カタログの4箇所で必ず同じ数字になる。
  const paperCounts = new Map<string, number>();
  for (const db of databases) {
    paperCounts.set(
      db.slug,
      papers.filter((p) => p.databases_used.includes(db.paper_tag)).length,
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">データベース一覧</h1>
        <p className="mt-1 text-muted-foreground">
          日本の医療リアルワールドデータ（RWD）データベースの特徴と、各DBを使った研究事例
        </p>
      </div>

      {/* Public DBs */}
      <section>
        <h2 className="mb-1 text-xl font-semibold">
          公的データベース
          <Badge variant="default" className="ml-2">
            {publicDbs.length}
          </Badge>
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {DATABASE_TYPE_DESCRIPTION.public}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {publicDbs.map((db) => (
            <DatabaseCard
              key={db.slug}
              db={db}
              paperCount={paperCounts.get(db.slug) || 0}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* 民間DB */}
      <section>
        <h2 className="mb-1 text-xl font-semibold">
          民間データベース
          <Badge variant="secondary" className="ml-2">
            {privateDbs.length}
          </Badge>
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {DATABASE_TYPE_DESCRIPTION.private}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {privateDbs.map((db) => (
            <DatabaseCard
              key={db.slug}
              db={db}
              paperCount={paperCounts.get(db.slug) || 0}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* 民間DB各社の論文一覧 */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">民間DB各社の論文一覧</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {privateDbLinks.map((link) => (
            <Card key={link.company}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{link.company}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {link.description}
                </p>
                <div className="flex gap-3 text-sm">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    論文一覧 →
                  </a>
                  {link.pdf_url && (
                    <a
                      href={link.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      PDF一覧 →
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Comparison table */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">データベース比較表</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">DB名</th>
                <th className="px-3 py-2 text-left font-medium">種別</th>
                <th className="px-3 py-2 text-left font-medium">管理者</th>
                <th className="px-3 py-2 text-left font-medium">対象規模</th>
                <th className="px-3 py-2 text-left font-medium">データ種別</th>
                <th className="px-3 py-2 text-right font-medium">研究数</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((db) => (
                <tr key={db.slug} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{db.name}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={db.type === "public" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {DATABASE_TYPE_LABEL[db.type]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {db.administrator}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {db.coverage}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {db.data_types.join("、")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {paperCounts.get(db.slug) || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
