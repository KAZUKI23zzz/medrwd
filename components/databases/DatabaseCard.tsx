import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DATABASE_TYPE_LABEL,
  DATABASE_TYPE_VARIANT,
  type RWDDatabase,
} from "@/types/database";
import { papersUrlForDatabase } from "@/lib/papers-url-state";

export function DatabaseCard({
  db,
  paperCount,
}: {
  db: RWDDatabase;
  paperCount: number;
}) {
  return (
    // 論文カードと同じく、カード全体を押せるようにする。
    // リンクを入れ子にはせず、DB名の <a> に擬似要素を敷いてカードを覆う（stretched link）。
    // 研究カタログへのリンクは別の行き先なので、その上に出す。
    <Card className="relative transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">
            <Link
              href={`/databases/${db.slug}`}
              className="hover:text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {db.name}
            </Link>
          </CardTitle>
          <Badge variant={DATABASE_TYPE_VARIANT[db.type]}>
            {DATABASE_TYPE_LABEL[db.type]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{db.administrator}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{db.data_types.join("、")}</p>
        <p className="text-muted-foreground">対象: {db.coverage}</p>
        <div>
          <span className="font-medium">向いている研究:</span>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {db.best_for.slice(0, 3).map((use) => (
              <li key={use}>{use}</li>
            ))}
          </ul>
        </div>
        {/* w-fit にして、リンクの無い右側の余白はカード全体のリンクに残す */}
        <div className="relative z-10 flex w-fit items-center pt-2">
          {/* 文言どおり、研究が並ぶ側（絞り込み済みのカタログ）へ直接送る */}
          <Link
            href={papersUrlForDatabase(db.paper_tag)}
            className="text-sm text-blue-600 hover:underline"
          >
            このDBを使った研究: {paperCount}件
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
