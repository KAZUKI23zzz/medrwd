import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSyncStatus } from "@/lib/data-loader";

export const metadata = {
  title: "同期ステータス - 医療RWD研究カタログ",
  description: "論文データの自動同期（収集・分類）の最終実行状況",
};

function formatJst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(d);
}

// 静的エクスポートはビルド時に評価される。最終同期からの経過日数で鮮度を判定。
function daysSince(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export default function StatusPage() {
  const s = getSyncStatus();
  const isSuccess = s.status === "success";
  const stale = daysSince(s.last_run) > 10; // 週次のはずが10日以上更新なし＝異常

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">同期ステータス</h1>
        <p className="text-sm text-muted-foreground">
          論文データは週次のClaude Routineが自動で収集・分類・要約しています。直近の実行結果を表示します。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">最終同期</CardTitle>
          <Badge
            variant={isSuccess ? "secondary" : "destructive"}
            className={
              isSuccess
                ? "border-green-200 bg-green-50 text-green-700"
                : undefined
            }
          >
            {isSuccess ? "成功" : "失敗"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">最終実行日時</span>
            <span className="font-medium">{formatJst(s.last_run)}（JST）</span>
          </div>

          {!isSuccess && s.error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              <p className="font-medium">停止中: {s.error}</p>
              {s.consecutive_failures > 0 && (
                <p className="mt-1 text-xs">
                  連続失敗回数: {s.consecutive_failures}
                </p>
              )}
            </div>
          )}

          {isSuccess && stale && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-700">
              最終同期から10日以上更新がありません。Routineが停止している可能性があります。
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{s.new_papers}</p>
              <p className="text-xs text-muted-foreground">新規追加</p>
            </div>
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{s.filtered_out}</p>
              <p className="text-xs text-muted-foreground">偽陽性除外</p>
            </div>
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{s.total_papers}</p>
              <p className="text-xs text-muted-foreground">総論文数</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
