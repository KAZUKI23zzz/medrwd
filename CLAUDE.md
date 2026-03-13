# MedRWD Japan - プロジェクト引き継ぎドキュメント

## 概要

日本の医療リアルワールドデータ（RWD）研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト。

- **本番URL**: https://medrwd-f553wm4wi-kazuki23zzzs-projects.vercel.app
- **GitHub**: https://github.com/KAZUKI23zzz/medrwd
- **設計原則**: 無料・低メンテナンス・合法（公式API/RSS/公開情報のみ）

## 技術スタック

| レイヤ | 技術 |
|--------|------|
| フレームワーク | Next.js 16 (Static Export: `output: "export"`) |
| 言語 | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui v4 |
| データストレージ | JSON ファイル（`data/`）← DBなし |
| 収集スクリプト | `scripts/` 内の TypeScript（`npx tsx` で実行） |
| スケジューラ | GitHub Actions cron（毎日 02:00 JST） |
| ホスティング | Vercel Hobby（静的サイト、無料） |

## ディレクトリ構成（主要ファイルのみ）

```
medrwd/
├── app/                          # Next.js App Router (Static Export)
│   ├── layout.tsx                # 共通レイアウト（ナビ + MobileNav）
│   ├── page.tsx                  # ダッシュボード（統計・DB別研究数チャート）
│   ├── papers/
│   │   ├── page.tsx              # 研究カタログ（メイン機能・フィルタ付き）
│   │   └── [id]/page.tsx         # 論文詳細（generateStaticParams で SSG）
│   ├── databases/
│   │   ├── page.tsx              # DB一覧（公的/商業 + 比較表）
│   │   └── [slug]/page.tsx       # DB詳細 + このDBを使った論文一覧
│   ├── news/page.tsx             # RSSニュース（厚労省・PMDA・medRxiv）
│   └── about/page.tsx            # サイト説明
│
├── components/
│   ├── MobileNav.tsx             # ハンバーガーメニュー（"use client"）
│   ├── papers/
│   │   ├── PaperFilters.tsx      # フィルタUI（"use client" / DB・デザイン・年・キーワード）
│   │   ├── PaperCard.tsx         # 論文カード
│   │   └── QuartileBadge.tsx     # Q1緑 Q2青 Q3橙 Q4赤
│   ├── databases/DatabaseCard.tsx
│   ├── news/NewsItem.tsx
│   └── ui/                       # shadcn/ui (badge, button, card, checkbox, input, separator)
│
├── lib/
│   ├── data-loader.ts            # JSON読み込み（getPapers, getDatabases, getNews, getCommercialLinks）
│   ├── collectors/
│   │   └── db-detector.ts        # アブストからDB名・研究デザイン検出（正規表現）
│   └── utils.ts                  # cn() ユーティリティ
│
├── scripts/
│   ├── sync-pubmed.ts            # PubMed + OpenAlex + DB検出 → papers.json
│   └── fetch-rss.ts              # RSS取得（厚労省・PMDA・medRxiv）→ news.json
│
├── data/                         # データストレージ（全てJSON・Git管理）
│   ├── papers.json               # 論文メタデータ（100件、自動更新）
│   ├── news.json                 # RSSニュース（2件、自動更新）
│   ├── databases.json            # RWDデータベース情報（7件、手動管理）
│   ├── db-keywords.json          # DB名検出用キーワード辞書
│   └── commercial-db-links.json  # 商業DB各社の論文一覧ページURL
│
├── types/                        # 型定義
│   ├── paper.ts
│   ├── database.ts
│   └── news.ts
│
├── .github/workflows/
│   └── daily-sync.yml            # 毎日 02:00 JST: sync-pubmed → fetch-rss → commit → Vercel自動リビルド
│
└── next.config.ts                # output: "export" のみ
```

## データ更新フロー

```
GitHub Actions (毎日 17:00 UTC = 02:00 JST)
  ├─ npx tsx scripts/sync-pubmed.ts
  │   ├─ PubMed esearch: 新着PMID取得（検索クエリは日本RWD関連）
  │   ├─ PubMed efetch: メタデータ取得（XML→パース）
  │   ├─ OpenAlex API: 雑誌IF取得（ISSN → 2yr_mean_citedness）
  │   ├─ db-detector.ts: アブストからDB名・研究デザイン検出
  │   └─ data/papers.json に追記（重複排除済み）
  ├─ npx tsx scripts/fetch-rss.ts
  │   ├─ 厚労省 RSS → RWDキーワードフィルタ → data/news.json
  │   ├─ PMDA RSS → フィルタなし（全件RWD関連）→ data/news.json
  │   └─ medRxiv RSS → RWDキーワードフィルタ → data/news.json
  └─ data/ に変更があれば git commit & push → Vercel自動リビルド
```

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド（静的エクスポート → out/ に出力）
npm run build

# 論文収集（手動実行）
npx tsx scripts/sync-pubmed.ts

# RSS取得（手動実行）
npx tsx scripts/fetch-rss.ts
```

## 現在の状態（2026-03-14）

### 完了済み（Phase 1 MVP）
- [x] Next.js プロジェクト初期化 + Static Export
- [x] データファイル作成（databases.json, db-keywords.json, commercial-db-links.json）
- [x] sync-pubmed.ts 作成・実行済み（100件収集、DB検出率72%、IF取得率99%）
- [x] fetch-rss.ts 作成・実行済み（厚労省RSS動作確認、RWDフィルタ適用済み）
- [x] 全ページ実装（ダッシュボード、研究カタログ、DB一覧、DB詳細、論文詳細、ニュース、About）
- [x] モバイル対応（ハンバーガーメニュー）
- [x] GitHub Actions daily-sync.yml 設定
- [x] GitHub リポジトリ作成・push済み（KAZUKI23zzz/medrwd）
- [x] Vercel デプロイ完了・全ページ動作確認済み

### 未実装（Phase 2）
- [ ] Pagefind 全文検索
- [ ] SJR CSV 取り込み（`scripts/import-sjr.ts`）→ より正確なQ1-Q4判定
- [ ] DB詳細ページ（/databases/[slug]）の充実（比較表等）
- [ ] Nitter RSS（X関連、停止リスクあるため優先度低）

## 既知の課題・注意点

1. **PMDA RSS が現在空**: フィード自体は存在するが、取得時に空だった。一時的な可能性あり
2. **medRxiv RSS も現在空**: Health Policy カテゴリのフィードが空。カテゴリ変更を検討可
3. **DB検出率 72%**: `data/db-keywords.json` のパターン追加で改善可能。未検出論文は `databases_used: []` のまま
4. **papers.json のスケール**: 現在100件。年500件×5年=2,500件、約5MBまでは問題なし
5. **GitHub Actions cron**: まだ初回自動実行されていない（手動トリガーで動作確認推奨）
6. **Node.js バージョン**: ローカルは v25.8.1、GitHub Actions は v22。互換性に注意

## デバッグTips

### ビルドエラー
```bash
# キャッシュクリアして再ビルド
rm -rf node_modules .next out && npm install && npm run build
```

### 論文収集のテスト
```bash
# sync-pubmed.ts は実行するたびに新着論文を追加（既存と重複しないPMIDのみ）
npx tsx scripts/sync-pubmed.ts
# 結果確認
cat data/papers.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Total: {len(d)} papers')"
```

### DB検出辞書の編集
`data/db-keywords.json` を編集 → `sync-pubmed.ts` 再実行で既存論文には反映されない。
既存論文に適用するには `db-detector.ts` を直接呼んで papers.json を再処理するスクリプトが必要。

### RSSフィルタの調整
`scripts/fetch-rss.ts` 内の `RWD_KEYWORDS` 配列を編集。
PMDA はフィルタなし（全件通過）、MHLW と medRxiv にフィルタ適用。

## アーキテクチャ上の設計判断

| 判断 | 理由 |
|------|------|
| Supabase不採用 → JSON | 7日無活動で休眠。日本RWD論文は年200-500件でJSON十分 |
| Static Export | DBなし=障害ポイントゼロ。Vercel無料枠で十分 |
| クライアントサイドフィルタ | 5,000件以下ならJSで十分高速。サーバー不要 |
| PubMed XML直接パース | 外部ライブラリ不要。XMLの構造は安定 |
| RSSの簡易XMLパース | 正規表現ベース。xml2js等の依存を排除 |
