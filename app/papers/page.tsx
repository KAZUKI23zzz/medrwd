import { getPapers } from "@/lib/data-loader";
import { PaperFilters } from "@/components/papers/PaperFilters";

export const metadata = {
  title: "研究カタログ - MedRWD Japan",
  description:
    "日本の医療RWDを使った研究を「どのDBで・どんな手法で・何を調べたか」で検索",
};

export default function PapersPage() {
  const papers = getPapers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">研究アプローチカタログ</h1>
        <p className="mt-1 text-muted-foreground">
          「どのDBで・どんな手法で・何を調べたか」から研究事例を探せます
        </p>
      </div>
      <PaperFilters papers={papers} />
    </div>
  );
}
