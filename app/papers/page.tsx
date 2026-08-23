import { Suspense } from "react";
import { getPapers } from "@/lib/data-loader";
import { PaperFilters } from "@/components/papers/PaperFilters";

export const metadata = {
  title: "研究カタログ - 医療RWD研究カタログ",
  description:
    "日本の医療RWDを使った研究を「どのDBで・どんな手法で・何を調べたか」で検索",
};

/** URL から絞り込み状態を読むまでの繋ぎ。レイアウトのガタつきを抑える形にしておく */
function PaperFiltersFallback() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full shrink-0 lg:w-64" />
      <div className="flex-1 py-12 text-center text-sm text-muted-foreground">
        読み込み中...
      </div>
    </div>
  );
}

export default function PapersPage() {
  // 一覧は全論文をクライアントに渡して絞り込むため、1件あたりの重さがそのまま
  // 初回表示の転送量になる（既知の課題: brotli後 約720KB）。
  // openalex_topic_score / openalex_field は一覧では表示にも検索にも使わないので落とす。
  // openalex_subfield はバッジと絞り込みに、openalex_topic は検索に使うので残す。
  const papers = getPapers().map((paper) => {
    const { openalex_topic_score, openalex_field, ...rest } = paper;
    void openalex_topic_score;
    void openalex_field;
    return rest;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">研究アプローチカタログ</h1>
        <p className="mt-1 text-muted-foreground">
          「どのDBで・どんな手法で・何を調べたか」から研究事例を探せます
        </p>
      </div>
      {/* PaperFilters は useSearchParams で絞り込み状態を読むため Suspense が要る */}
      <Suspense fallback={<PaperFiltersFallback />}>
        <PaperFilters papers={papers} />
      </Suspense>
    </div>
  );
}
