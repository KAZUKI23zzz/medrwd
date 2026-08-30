import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPapers, getSyncStatus, getUnknownTopics } from "@/lib/data-loader";
import { StaleWarning } from "@/components/status/StaleWarning";

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

/**
 * 経過日数。**静的エクスポートなのでビルド時に評価される。**
 *
 * 使ってよいのは、比較相手が過去の固定日で、遅れて困らないものだけ
 * （未登録トピックの棚卸し期限がこれ）。最終同期の鮮度判定には使えない
 * ので、そちらは components/status/StaleWarning.tsx が閲覧者の時計で測る。
 */
function daysSince(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * 未登録トピックを棚卸しする目安。これを超えたものがあれば注意を促す。
 * 溜まってすぐ困るものではないので、ビルドを落としたり赤で出したりはしない。
 */
const TOPIC_REVIEW_DAYS = 180;

export default function StatusPage() {
  const s = getSyncStatus();
  const isSuccess = s.status === "success";
  // 総件数は papers.json から数える。sync-status.json 側の値は Routine(LLM) が
  // 手で書いており、手順7で論文を取り除くと実態とずれる（機械が数えれば嘘をつかない）
  const totalPapers = getPapers().length;

  // 辞書に無いトピック。エラーではなく「そのうち辞書に足すもの」の待ち行列。
  const topics = getUnknownTopics();
  const unknownPapers = topics.unknown.reduce((n, t) => n + t.papers, 0);
  const oldest = topics.unknown[0]?.first_seen; // first_seen の昇順で並んでいる
  const dueForReview =
    oldest !== undefined && daysSince(oldest) >= TOPIC_REVIEW_DAYS;

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

          {isSuccess && <StaleWarning lastRun={s.last_run} />}

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
              <p className="text-2xl font-bold">{totalPapers}</p>
              <p className="text-xs text-muted-foreground">総論文数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">診療分野の辞書</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            論文の診療分野は OpenAlex
            のトピックを辞書で引いて決めています。OpenAlex
            が新しいトピックを作ると辞書に無い状態になり、その論文には診療分野が付きません。
            ここはその待ち行列です。
          </p>

          {topics.unknown.length === 0 ? (
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
              未登録のトピックはありません（{topics.updated_at} 時点）。
            </p>
          ) : (
            <>
              {dueForReview && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-700">
                  {oldest} から未登録のままのトピックがあります。
                  辞書（<code>data/topic-areas.json</code>）への追記を検討してください。
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{topics.unknown.length}</p>
                  <p className="text-xs text-muted-foreground">未登録トピック</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{unknownPapers}</p>
                  <p className="text-xs text-muted-foreground">
                    分野が付かない論文
                  </p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{oldest ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">最古の初出</p>
                </div>
              </div>
              <ul className="space-y-1">
                {topics.unknown.slice(0, 10).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-baseline justify-between gap-3 border-b pb-1 last:border-b-0"
                  >
                    <span>{t.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t.papers}件 / {t.first_seen}
                    </span>
                  </li>
                ))}
              </ul>
              {topics.unknown.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  ほか {topics.unknown.length - 10} 種
                </p>
              )}
            </>
          )}

          {topics.renamed.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="font-medium">
                OpenAlex 側で名前が変わったトピック: {topics.renamed.length}種
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                診療分野はIDで引いているので影響はありません。辞書の名前を直すだけです。
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {topics.renamed.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <span className="text-muted-foreground">
                      {t.dictionary_name}
                    </span>{" "}
                    → {t.openalex_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
