import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CLINICAL_AREAS } from "@/lib/clinical-areas";

export const metadata = {
  title: "About - 医療RWD研究カタログ",
  description: "医療RWD研究カタログについて",
};

// 収録件数や付与率といった数字はここに書かない。必ず古くなるうえ、
// 論文数はダッシュボードに出ている。ここは「何をどう作っているか」だけを書く。
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
            で検索できるカタログサイトです。収録した論文を、日本で使われている
            主要なRWDデータベースと対応づけています。
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
          <CardTitle>掲載情報の作られ方</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            収録している情報には、
            <strong className="text-foreground">
              出典からそのまま取得したもの
            </strong>
            と、
            <strong className="text-foreground">
              生成AIが判断して付けたもの
            </strong>
            が混在しています。どちらなのかを項目ごとに示します。
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="default" className="mt-0.5 shrink-0">
                そのまま
              </Badge>
              <div>
                <p className="font-medium">
                  タイトル（英語）・著者・雑誌名・出版日・DOI・アブストラクト
                </p>
                <p className="mt-1 text-muted-foreground">
                  PubMed から取得した値をそのまま表示しています。加工していません。
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="default" className="mt-0.5 shrink-0">
                そのまま
              </Badge>
              <div>
                <p className="font-medium">CI（引用指標）・トピック</p>
                <p className="mt-1 text-muted-foreground">
                  OpenAlex から取得した値です。詳細ページの「トピック（OpenAlex）」に
                  出している関連度の数値も OpenAlex が算出したものです。
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                AI生成
              </Badge>
              <div>
                <p className="font-medium">
                  日本語タイトル・AI要約・研究デザイン・研究カテゴリ・解析手法・使用データベース
                </p>
                <p className="mt-1 text-muted-foreground">
                  これらは
                  <strong className="text-foreground">
                    生成AIがアブストラクトを読んで判断した結果
                  </strong>
                  であり、著者や出版社が付けた情報ではありません。
                  誤りが含まれる可能性があります。
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>AI要約</strong>
                    ：アブストラクトの全文訳ではなく、2〜3文に要約したものです。
                    原文の情報は落ちています。
                  </li>
                  <li>
                    <strong>使用データベース</strong>
                    ：本文中の記述から判断しています。DB名が明示されていない論文では
                    特定できず、判明した範囲を「追加データソース」として記載しています。
                  </li>
                </ul>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                独自
              </Badge>
              <div>
                <p className="font-medium">診療分野</p>
                <p className="mt-1 text-muted-foreground">
                  OpenAlex のトピックを、当サイトが独自に作成した辞書で日本の診療科
                  {CLINICAL_AREAS.length}分野へ写像したものです。OpenAlex
                  が提供する分類ではありません。1つの論文が複数の分野を持つことが
                  あります（例：乳がん患者の眼有害事象 → 乳腺・眼科）。
                  辞書に無いトピックには分野が付きません。
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                独自
              </Badge>
              <div>
                <p className="font-medium">関連研究</p>
                <p className="mt-1 text-muted-foreground">
                  英語のタイトルとアブストラクトの語の重なりを基に、
                  診療分野とトピックの一致で重み付けして算出しています。
                  引用関係ではありません。
                </p>
              </div>
            </div>
          </div>
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
                  論文の書誌情報（タイトル・著者名・雑誌名・DOI等）およびアブストラクトは、
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
                引用指標・トピック
              </Badge>
              <div>
                <p>
                  <strong>OpenAlex API</strong>（CC0 ライセンス）
                </p>
                <p className="mt-1 text-muted-foreground">
                  本サイトで「CI」として表示している数値は、OpenAlex が算出する
                  2yr Mean Citedness（2年間平均被引用数）であり、Clarivate
                  Analytics 社の Journal Impact Factor&trade;
                  とは異なります。トピックとその関連度も OpenAlex
                  から取得しています。OpenAlex
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
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                DB情報
              </Badge>
              <div>
                <p className="text-muted-foreground">
                  「DB一覧」に掲載しているデータベースの概要・規模・提供元等は、
                  各提供機関の公開情報を基に手作業でまとめたものです。
                  最新の内容は各提供元でご確認ください。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>更新のしくみ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">
              論文データ：週次で自動更新。
            </strong>{" "}
            PubMed から新着論文を収集し、生成AIが分類・日本語要約を行い、
            対象外の論文（日本以外の研究・動物実験・レター等）を除外したうえで公開します。
            収集から公開までを一連の自動処理で行っています。
          </p>
          <p>
            <strong className="text-foreground">
              データベース情報：手動更新。
            </strong>{" "}
            変更を把握した時点で反映しています。
          </p>
          <p>
            直近の実行結果は{" "}
            <a href="/status" className="text-blue-600 hover:underline">
              同期ステータス
            </a>{" "}
            で公開しています。失敗した場合もそのまま表示します。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>技術スタック</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Next.js（静的エクスポート）</li>
            <li>TypeScript + Tailwind CSS + shadcn/ui</li>
            <li>Claude Routine（週次の収集・分類・要約）</li>
            <li>Vercel（静的サイトホスティング）</li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            データベースサーバは使わず、JSONファイルを静的サイトに焼き込んでいます。
            すべて無料サービスの範囲内で運用しています。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>生成AIの利用について</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            本サイトは、
            <strong className="text-foreground">
              掲載内容の一部と、サイト自体の開発の両方
            </strong>
            に生成AIを利用しています。
          </p>
          <p>
            <strong className="text-foreground">掲載内容：</strong>{" "}
            日本語タイトル・AI要約・研究デザイン・研究カテゴリ・解析手法・使用データベースは、
            Anthropic 社の Claude がアブストラクトを読んで生成・判断したものです。
            人手による全件確認は行っていません。誤りや見落としが含まれます。
            研究・業務でご利用の際は、必ず論文原文をご確認ください。
          </p>
          <p>
            <strong className="text-foreground">開発：</strong> 設計・実装・レビューに{" "}
            <a
              href="https://claude.ai/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Claude Code
            </a>{" "}
            を利用しています。生成物は人間による確認を経ていますが、
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
            掲載されている論文情報・データベース情報は、外部APIから自動収集し、
            生成AIによる処理を経たものであり、
            その正確性・完全性・最新性を保証するものではありません。
            情報の利用はすべて利用者自身の責任において行ってください。
          </p>
          <p>
            とくに、生成AIが判断した項目（分類・使用データベース・日本語要約）と、
            自動処理された指標（CI値・診療分野・関連研究）には、
            誤り・欠損・遅延が含まれます。
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
