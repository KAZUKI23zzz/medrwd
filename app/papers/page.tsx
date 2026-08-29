import { Suspense } from "react";
import { getPapers } from "@/lib/data-loader";
import type { ListPaper } from "@/types/paper";
import {
  clinicalAreasOf,
  assertTopicAreasValid,
} from "@/lib/clinical-areas";
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
  // 辞書の自己点検。分野名の変更漏れやカンマ混入をビルド時に落とす
  assertTopicAreasValid();
  // 一覧は全論文をクライアントへ渡して絞り込む作りなので、1件あたりの重さが
  // そのまま初回表示の転送量になる。一覧が実際に使うフィールドだけを写し取る。
  //
  // キャストを使わず1つずつ書き写しているのは、TypeScript に過不足を検査させるため。
  // 返り値に型注釈を付けてあるので、必須フィールドの書き忘れも、ListPaper に無い
  // フィールドの書き足しも、どちらもビルドが落ちる（実際に両方試して確認済み）。
  //
  // ただし省略可能なフィールド（title_ja / abstract_ja）の書き忘れは型では
  // 捕まらない。消すと検索や表示から黙って抜けるので、この2つを触るときは
  // 実際の画面で確かめること。
  //
  // ここに無いフィールドは配信されない。落としている主なもの:
  //  - journal_issn / collected_at / last_updated /
  //    auto_detected / classified / openalex_topic / openalex_topic_score /
  //    openalex_subfield / openalex_field: 一覧のどこからも参照していない
  //  - openalex_topics: スコアつきの生データ。一覧が要るのは検索用の名前だけ
  //    なので、topic_names に写して落としている
  //
  // データ側からは消さない。詳細ページ・About の権利表記・将来の軸で使う。
  // 全部落として brotli 後 736KB → 705KB。
  const papers: ListPaper[] = getPapers().map((paper): ListPaper => ({
    id: paper.id,
    pubmed_id: paper.pubmed_id,
    doi: paper.doi,
    title: paper.title,
    title_ja: paper.title_ja,
    abstract: paper.abstract,
    abstract_ja: paper.abstract_ja,
    authors: paper.authors,
    journal: paper.journal,
    year: paper.year,
    publication_date: paper.publication_date,
    databases_used: paper.databases_used,
    additional_data_sources: paper.additional_data_sources,
    study_design: paper.study_design,
    analysis_methods: paper.analysis_methods,
    research_categories: paper.research_categories,
    impact_factor: paper.impact_factor,
    sjr_quartile: paper.sjr_quartile,
    clinical_areas: clinicalAreasOf(paper.openalex_topics),
    topic_names: (paper.openalex_topics ?? []).map((t) => t.name),
  }));

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
