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
│   │   ├── PaperFilters.tsx      # フィルタUI（"use client" / DB・デザイン・カテゴリ・年・キーワード）
│   │   ├── PaperCard.tsx         # 論文カード（DB・デザイン・カテゴリ表示）
│   │   └── QuartileBadge.tsx     # Q1緑 Q2青 Q3橙 Q4赤
│   ├── databases/DatabaseCard.tsx
│   ├── news/NewsItem.tsx
│   └── ui/                       # shadcn/ui (badge, button, card, checkbox, input, separator)
│
├── lib/
│   ├── data-loader.ts            # JSON読み込み（getPapers, getDatabases, getNews, getCommercialLinks）
│   ├── collectors/
│   │   └── db-detector.ts        # アブストからDB名・研究デザイン・研究カテゴリ検出（正規表現プリコンパイル）
│   └── utils.ts                  # cn() ユーティリティ
│
├── scripts/
│   ├── sync-pubmed.ts            # PubMed + OpenAlex + DB検出 + カテゴリ分類 → papers.json
│   ├── reclassify-categories.ts  # 既存論文の研究カテゴリ一括再分類（手動実行用）
│   └── fetch-rss.ts              # RSS取得（厚労省・PMDA・medRxiv）→ news.json
│
├── data/                         # データストレージ（全てJSON・Git管理）
│   ├── papers.json               # 論文メタデータ（101件、自動更新、研究カテゴリ付き）
│   ├── news.json                 # RSSニュース（2件、自動更新）
│   ├── databases.json            # RWDデータベース情報（7件、手動管理）
│   ├── db-keywords.json          # DB名・研究デザイン・研究カテゴリ検出用キーワード辞書
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
  │   ├─ db-detector.ts: アブストからDB名・研究デザイン・研究カテゴリ検出
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

# 既存論文の研究カテゴリを再分類（パターン辞書変更後に実行）
npx tsx scripts/reclassify-categories.ts
```

## 現在の状態（2026-03-15）

### 完了済み（Phase 1 MVP）
- [x] Next.js プロジェクト初期化 + Static Export
- [x] データファイル作成（databases.json, db-keywords.json, commercial-db-links.json）
- [x] sync-pubmed.ts 作成・実行済み（101件収集、DB検出率72%、IF取得率99%）
- [x] fetch-rss.ts 作成・実行済み（厚労省RSS動作確認、RWDフィルタ適用済み）
- [x] 全ページ実装（ダッシュボード、研究カタログ、DB一覧、DB詳細、論文詳細、ニュース、About）
- [x] モバイル対応（ハンバーガーメニュー）
- [x] GitHub Actions daily-sync.yml 設定
- [x] GitHub リポジトリ作成・push済み（KAZUKI23zzz/medrwd）
- [x] Vercel デプロイ完了・全ページ動作確認済み

### 完了済み（Phase 1.5: 研究カテゴリ）PR #2 マージ済み
- [x] 研究カテゴリ分類機能（7カテゴリ＋その他）
  - 治療実態・処方パターン / 治療効果・有効性 / 安全性・副作用 / 疾病負荷・自然歴 / 医療資源利用・経済評価 / 医療の質・アクセスの格差 / 患者報告アウトカム・QOL
- [x] スコアリングベースの分類ロジック（パターンマッチ数で上位2カテゴリまで付与）
- [x] db-keywords.json にカテゴリ辞書追加（各カテゴリ15-20パターン）
- [x] db-detector.ts で正規表現プリコンパイル（2,500件スケール対応）
- [x] sync-pubmed.ts に自動分類を統合（新規論文は取得時に自動分類）
- [x] reclassify-categories.ts 作成（既存論文一括再分類、検出率83%）
- [x] PaperFilters にカテゴリフィルタ追加 + 検索haystackにカテゴリ含む
- [x] PaperCard / 論文詳細 / ダッシュボードにカテゴリ表示追加
- [x] Paper型に `research_categories: string[]` フィールド追加

### 未実装（Phase 2）
- [ ] Pagefind 全文検索
- [ ] SJR CSV 取り込み（`scripts/import-sjr.ts`）→ より正確なQ1-Q4判定
- [ ] DB詳細ページ（/databases/[slug]）の充実（比較表等）
- [ ] Nitter RSS（X関連、停止リスクあるため優先度低）
- [ ] 研究カテゴリの検出率向上（現在83%、「その他」17件のパターン追加）

## 既知の課題・注意点

1. **PMDA RSS が現在空**: フィード自体は存在するが、取得時に空だった。一時的な可能性あり
2. **medRxiv RSS も現在空**: Health Policy カテゴリのフィードが空。カテゴリ変更を検討可
3. **DB検出率 72%**: `data/db-keywords.json` のパターン追加で改善可能。未検出論文は `databases_used: []` のまま
4. **研究カテゴリ検出率 83%**: 17件が「その他」。アブストがない論文（3件）は分類不可。残り14件はパターン辞書の追加で改善可能
5. **papers.json のスケール**: 現在101件。年500件×5年=2,500件、約5MBまでは問題なし
6. **GitHub Actions cron**: まだ初回自動実行されていない（手動トリガーで動作確認推奨）
7. **Node.js バージョン**: ローカルは v25.8.1、GitHub Actions は v22。互換性に注意
8. **sync-pubmed.ts の関数重複**: `matchPatterns` / `countPatternMatches` が `db-detector.ts` と重複。TSモジュール制約（`@/` パスエイリアスがスクリプトで使えない）のため意図的な重複。将来的には共通ユーティリティに抽出可能

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

### DB検出辞書・研究カテゴリ辞書の編集
`data/db-keywords.json` を編集 → `sync-pubmed.ts` 再実行で既存論文には反映されない。
既存論文のカテゴリを再分類するには:
```bash
npx tsx scripts/reclassify-categories.ts
```
このスクリプトは `research_categories` のみを更新する。DB検出の再適用には別途スクリプトが必要。

### 研究カテゴリの分類ロジック
- `db-keywords.json` の `research_categories` に7カテゴリの正規表現パターンを定義
- タイトル＋アブストラクト＋MeSHタームを結合したテキストに対してパターンマッチ
- 各カテゴリのマッチ数（スコア）で順位付け → 上位2カテゴリまで付与
- どのカテゴリにもマッチしない場合は「その他」
- `db-detector.ts` ではモジュールロード時に正規表現をプリコンパイル（ビルド時のパフォーマンス最適化）

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
| カテゴリ分類: スコアリング方式 | 単純なマッチ有無ではなくマッチ数で順位付け。複数カテゴリに該当する論文を適切に上位2つに絞れる |
| 正規表現プリコンパイル | 論文数増加時のビルドパフォーマンス確保。2,500件×7カテゴリ×20パターン=35万回のコンパイルを回避 |
