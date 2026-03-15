import { getNews } from "@/lib/data-loader";
import { NewsItemCard } from "@/components/news/NewsItem";

export const metadata = {
  title: "ニュース - 医療RWD研究カタログ",
  description: "PMDA・JMDC・MDVの最新RWD関連情報",
};

export default function NewsPage() {
  const news = getNews();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ニュース</h1>
        <p className="mt-1 text-muted-foreground">
          PMDA の最新RWD関連情報（RSSキュレーション）と商業DB各社のお知らせ
        </p>
      </div>

      {/* PMDA news */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">
          PMDA（医薬品医療機器総合機構）
        </h2>
        {news.length > 0 ? (
          <div className="space-y-2">
            {news.map((item) => (
              <NewsItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              PMDA のRWD関連ニュースはまだ収集されていません
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              RSS フィードからの自動収集が開始されると、ここに表示されます。
            </p>
          </div>
        )}
      </div>

      {/* External links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">商業DB各社のお知らせ</h2>
        <div className="space-y-2">
          <a
            href="https://www.jmdc.co.jp/news/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
          >
            <div>
              <span className="font-medium">JMDC お知らせ</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                JMDC Claims Database 関連の最新情報
              </p>
            </div>
            <span className="text-blue-600">→</span>
          </a>
          <a
            href="https://www.mdv.co.jp/news/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
          >
            <div>
              <span className="font-medium">MDV（メディカル・データ・ビジョン）新着情報</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                MDV データベース関連の最新情報
              </p>
            </div>
            <span className="text-blue-600">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
