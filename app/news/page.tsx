import { getNews } from "@/lib/data-loader";
import { NewsItemCard } from "@/components/news/NewsItem";

export const metadata = {
  title: "ニュース - MedRWD Japan",
  description: "厚労省・PMDA・medRxivの最新情報をRSSでキュレーション",
};

export default function NewsPage() {
  const news = getNews();

  const sources = ["すべて", "PMDA", "MHLW", "medRxiv"] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ニュース</h1>
        <p className="mt-1 text-muted-foreground">
          厚生労働省・PMDA・medRxiv の最新情報をRSSでキュレーション
        </p>
      </div>

      {news.length > 0 ? (
        <div className="space-y-2">
          {news.map((item) => (
            <NewsItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-lg text-muted-foreground">
            ニュースはまだ収集されていません
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            RSS フィードからの自動収集が開始されると、ここに表示されます。
          </p>
        </div>
      )}
    </div>
  );
}
