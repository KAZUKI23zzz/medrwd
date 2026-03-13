import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "About - MedRWD Japan",
  description: "MedRWD Japanについて",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">About MedRWD Japan</h1>

      <Card>
        <CardHeader>
          <CardTitle>このサイトについて</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            MedRWD Japan
            は、日本の医療リアルワールドデータ（RWD）を使った研究を
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
          <CardTitle>データソース</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Badge variant="default">論文</Badge>
            <span>PubMed E-utilities API（公式・無料）</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default">雑誌IF</Badge>
            <span>OpenAlex API（無料・CC0ライセンス）</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default">ニュース</Badge>
            <span>厚生労働省 RSS / PMDA RSS / medRxiv RSS</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">DB名検出</Badge>
            <span>
              論文のタイトル・アブストラクトから、使用DBをキーワードマッチで自動検出
            </span>
          </div>
          <Separator />
          <p className="text-muted-foreground">
            DB名の自動検出は完全ではありません。未検出や誤検出の可能性があります。
            正確な情報は論文原文をご確認ください。
          </p>
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
            毎日自動更新（RSS経由で厚労省・PMDA・medRxivから取得）
          </p>
          <p>
            <strong>データベース情報:</strong> 手動更新（変更があった場合）
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
