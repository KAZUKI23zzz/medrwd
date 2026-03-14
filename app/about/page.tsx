import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "About - 医療RWD研究カタログ",
  description: "医療RWD研究カタログについて",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">About 医療RWD研究カタログ</h1>

      <Card>
        <CardHeader>
          <CardTitle>このサイトについて</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            医療RWD研究カタログは、日本の医療リアルワールドデータ（RWD）を使った研究を
            <strong>
              「どのデータベースで・どんな手法で・何を調べたか」
            </strong>
            で検索できるカタログサイトです。
          </p>
          <p>
            例えば、「NDBを使ったコホート研究にはどんなものがあるか」
            「JMDCデータを使って疾病自然史を調べた論文は？」
            といった疑問にすぐに答えが見つかります。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>データソースと帰属表示</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="default" className="mt-0.5 shrink-0">
                論文
              </Badge>
              <div>
                <p>
                  <strong>PubMed E-utilities API</strong>（NCBI / NLM / NIH）
                </p>
                <p className="mt-1 text-muted-foreground">
                  論文の書誌情報（タイトル・著者名・雑誌名・DOI・MeSH用語等）およびアブストラクトは、
                  米国国立医学図書館（NLM）が提供する PubMed E-utilities API
                  を通じて取得しています。アブストラクトの著作権は各出版社に帰属します。
                  本サイトは NLM・NIH・HHS による推薦・支持を受けたものではありません。
                </p>
                <a
                  href="https://www.ncbi.nlm.nih.gov/home/about/policies/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  NCBI Website and Data Usage Policies →
                </a>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="default" className="mt-0.5 shrink-0">
                引用指標
              </Badge>
              <div>
                <p>
                  <strong>OpenAlex API</strong>（CC0 ライセンス）
                </p>
                <p className="mt-1 text-muted-foreground">
                  本サイトで「CI」として表示している数値は、OpenAlex が算出する
                  2yr Mean Citedness（2年間平均被引用数）であり、Clarivate
                  Analytics 社の Journal Impact Factor&trade;
                  とは異なります。OpenAlex
                  のデータはCC0（パブリックドメイン）で提供されています。
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  引用: Priem, J., Piwowar, H., &amp; Orr, R. (2022). OpenAlex:
                  A fully-open index of scholarly works, authors, venues,
                  institutions, and concepts. ArXiv.
                  https://arxiv.org/abs/2205.01833
                </p>
                <a
                  href="https://docs.openalex.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  OpenAlex Documentation →
                </a>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="default" className="mt-0.5 shrink-0">
                ニュース
              </Badge>
              <div>
                <p>
                  <strong>PMDA RSS / medRxiv RSS</strong>
                </p>
                <p className="mt-1 text-muted-foreground">
                  ニュースは PMDA（医薬品医療機器総合機構）および medRxiv
                  のRSSフィードから取得しています。各記事の著作権は配信元に帰属します。
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                DB名検出
              </Badge>
              <div>
                <p className="text-muted-foreground">
                  論文のタイトル・アブストラクトから、使用DBをキーワードマッチで自動検出しています。
                  自動検出は完全ではなく、未検出や誤検出の可能性があります。
                  正確な情報は論文原文をご確認ください。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>技術スタック</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Next.js (Static Export)</li>
            <li>TypeScript + Tailwind CSS + shadcn/ui</li>
            <li>GitHub Actions（毎日の自動データ収集）</li>
            <li>Vercel（静的サイトホスティング）</li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            すべて無料サービスの範囲内で運用しています。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>更新頻度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>論文データ:</strong> 毎日自動更新（GitHub
            Actions経由でPubMed APIから新着論文を取得）
          </p>
          <p>
            <strong>ニュース:</strong>{" "}
            毎日自動更新（RSS経由でPMDA・medRxivから取得）
          </p>
          <p>
            <strong>データベース情報:</strong> 手動更新（変更があった場合）
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>生成AIの利用について</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            本サイトは、Anthropic 社の{" "}
            <a
              href="https://claude.ai/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Claude Code
            </a>
            （生成AIコーディングツール）を活用して設計・開発されています。
          </p>
          <p>
            生成AIはコードの作成・レビュー・最適化を支援する目的で使用しています。
            ただし、生成AIの出力には誤りが含まれる可能性があり、
            すべての生成物は人間による確認・検証を経ています。
            生成AIの利用に起因する瑕疵について、開発者は合理的な範囲で対応しますが、
            完全な正確性を保証するものではありません。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>免責事項</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            本サイトは、医療RWD研究の検索・参照を支援する目的で提供されており、
            医療上の助言、診断、治療の推奨を行うものではありません。
            医療に関する判断は、必ず医療専門家にご相談ください。
          </p>
          <p>
            掲載されている論文情報・データベース情報・ニュースは、
            外部APIおよびRSSフィードから自動収集したものであり、
            その正確性・完全性・最新性を保証するものではありません。
            情報の利用はすべて利用者自身の責任において行ってください。
          </p>
          <p>
            DB名の自動検出（キーワードマッチ）や引用指標（CI値）等の自動処理された情報には、
            誤検出・欠損・遅延が含まれる可能性があります。
            研究・業務で利用される場合は、必ず論文原文およびデータ提供元にて情報をご確認ください。
          </p>
          <p>
            本サイトの利用により生じたいかなる損害についても、
            サイト運営者は一切の責任を負いません。
          </p>
          <p>
            本サイトに掲載されている商標・ロゴ等は、各権利者に帰属します。
            Journal Impact Factor&trade; は Clarivate Analytics
            社の登録商標です。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
