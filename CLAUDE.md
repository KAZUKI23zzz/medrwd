# MedRWD Japan

日本の医療RWD研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト。

- **本番URL**: https://medrwd.vercel.app （デプロイ個別のURLは404になるので恒久エイリアスを使う）
- **GitHub**: https://github.com/KAZUKI23zzz/medrwd
- **設計原則**: 無料・低メンテナンス・合法（公式API/RSS/公開情報のみ）

## 技術スタック

Next.js 16 (Static Export) / TypeScript / Tailwind CSS v4 + shadcn/ui v4 / JSON（DBなし） / Claude Routine（週次・収集＋分類を自動化） / Vercel Hobby

## 主要ディレクトリ

| パス | 役割 |
|------|------|
| `app/` | Next.js App Router（ダッシュボード・研究カタログ・DB一覧・About・status） |
| `scripts/sync-pubmed.ts` | PubMed収集（収集専任: hasabstract + OpenAlex IF → classified:false で追記）。分類・翻訳はしない |
| `data/papers.json` | 論文メタデータ（880件、全件分類済み） |
| `data/sync-status.json` | 同期の最終実行状況（Routineが毎回更新、`/status`で表示） |
| `data/databases.json` | RWDデータベース情報（6件） |
| `docs/routine-classify.md` | **Routineのプロンプト全文＋セットアップ手順** |
| `docs/classification.md` | **分類スキーマ・偽陽性基準（Routineが参照する正）** |
| `docs/DEVELOPMENT.md` | デバッグTips・設計判断・検索式比較・法的リスク・変更履歴 |
| `docs/related-papers.md` | **未着手**: 詳細ページの「関連研究」が機能していない問題の引き継ぎ（独立課題） |
| `lib/favorites.ts` | お気に入り論文（localStorage のみ。サーバ・アカウント不要） |

## よく使うコマンド

```bash
npm run dev                              # 開発サーバー
npm run build                            # 静的エクスポート → out/
npx tsx scripts/sync-pubmed.ts           # 論文収集（手動。通常はRoutineが実行）
```

## 現在の状態

**Track 2 完了: 収集・分類フローをRoutine一本化**
- 自動化は週次の **Claude Routine 1つ**（収集→分類→日本語要約→偽陽性除外→main自動マージ）。GitHub Actions・Google翻訳・PMDAニュースは廃止。
- `abstract_ja` は全文訳ではなく**2〜3文の日本語AI要約**（WEB上は「AI要約」表示）。
- 失敗の可視化は `/status` ページ（`data/sync-status.json`）＋セーフマージ・ガード。
- Routineのセットアップ/運用は `docs/routine-classify.md` 参照。要設定2点: ①クラウド環境のネットワーク許可に `eutils.ncbi.nlm.nih.gov`・`api.openalex.org` ②Claude GitHub Appをwrite権限で導入。

**お気に入り**: `localStorage` にID一覧を持つだけで、アカウント登録もサーバも不要。
`/papers?fav=1` で絞り込める。端末をまたいで共有されず、iOS Safari は7日間未訪問で
自動削除することがある（画面上でも断っている）。共有用のURLとしては使えない
（受け取った人には「その人のお気に入り」が出るため）。

**未実装（Phase 3）**: Pagefind全文検索 / SJR CSV取込 / DB詳細ページ充実

## 既知の課題

1. （解消）~~Google Translate無料EP~~ → 翻訳・要約はRoutine(LLM)に移管し廃止。
