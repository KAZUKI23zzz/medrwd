import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RWDDatabase } from "@/types/database";

export function DatabaseCard({
  db,
  paperCount,
}: {
  db: RWDDatabase;
  paperCount: number;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">
            <Link
              href={`/databases/${db.slug}`}
              className="hover:text-primary"
            >
              {db.name}
            </Link>
          </CardTitle>
          <Badge variant={db.type === "public" ? "default" : "secondary"}>
            {db.type === "public" ? "公的" : "商業"}
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
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/databases/${db.slug}`}
            className="text-sm text-blue-600 hover:underline"
          >
            このDBを使った研究: {paperCount}件
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
