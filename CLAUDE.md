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
| スケジューラ | GitHub Actions cron（毎週月曜 02:00 JST） |
| ホスティング | Vercel Hobby（静的サイト、無料） |

## ディレクトリ構成（主要ファイルのみ）

```
medrwd/
├── app/                          # Next.js App Router (Static Export)
│   ├── layout.tsx                # 共通レイアウト（ナビ + MobileNav）
│   ├── page.tsx                  # ダッシュボード（統計・DB別研究数チャート・最新ニュース）
│   ├── papers/
│   │   ├── page.tsx              # 研究カタログ（メイン機能・フィルタ付き）
│   │   └── [id]/page.tsx         # 論文詳細（generateStaticParams で SSG）
│   ├── databases/
│   │   ├── page.tsx              # DB一覧（公的/商業 + 比較表）
│   │   └── [slug]/page.tsx       # DB詳細 + このDBを使った論文一覧
│   ├── news/page.tsx             # ニュース（PMDA RSS + JMDC/MDV外部リンク）
│   └── about/page.tsx            # サイト説明
│
├── components/
│   ├── MobileNav.tsx             # ハンバーガーメニュー（"use client"）
│   ├── papers/
│   │   ├── PaperFilters.tsx      # フィルタUI（"use client" / DB・デザイン・カテゴリ・年・キーワード）
│   │   ├── PaperCard.tsx         # 論文カード（DB・デザイン・カテゴリ・日本語訳表示）
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
│   ├── sync-pubmed.ts            # PubMed + OpenAlex + DB検出 + カテゴリ分類 + 日本語訳 + 不完全論文再取得 → papers.json
│   ├── translate-papers.ts       # 既存論文の日本語訳一括付与（手動実行用）
│   ├── reclassify-categories.ts  # 既存論文の研究カテゴリ一括再分類（手動実行用）
│   └── fetch-rss.ts              # PMDA RSS取得 → news.json
│
├── data/                         # データストレージ（全てJSON・Git管理）
│   ├── papers.json               # 論文メタデータ（101件、自動更新、日本語訳・研究カテゴリ付き）
│   ├── news.json                 # PMDAニュース（6件、自動更新）
│   ├── databases.json            # RWDデータベース情報（6件、手動管理）
│   ├── db-keywords.json          # DB名・研究デザイン・研究カテゴリ検出用キーワード辞書
│   └── commercial-db-links.json  # 商業DB各社のデータベース事業ページURL（JMDC・MDV）
│
├── types/                        # 型定義
│   ├── paper.ts                  # Paper型（title_ja, abstract_ja, medline_status, last_updated 含む）
│   ├── database.ts
│   └── news.ts
│
├── .github/workflows/
│   └── daily-sync.yml            # 毎週月曜 17:00 UTC: sync-pubmed → fetch-rss → commit → Vercel自動リビルド
│
└── next.config.ts                # output: "export" のみ
```

## データ更新フロー

```
GitHub Actions (毎週月曜 17:00 UTC = 02:00 JST)
  ├─ npx tsx scripts/sync-pubmed.ts
  │   ├─ 1. 不完全論文の再取得（abstract空 or MeSH未付与の論文を月1回再取得）
  │   │   ├─ MedlineCitation Status で判定: Publisher/In-Process → 再取得対象
  │   │   ├─ MEDLINE → 完了（MeSH付与済み）、PubMed-not-MEDLINE → 再取得停止
  │   │   └─ 更新時: abstract/MeSH/DB検出/カテゴリ分類/日本語訳を再実行
  │   ├─ 2. 新着論文の収集（PubMed esearch: 過去14日）
  │   │   ├─ PubMed efetch: メタデータ取得（XML→パース）
  │   │   ├─ OpenAlex API: 雑誌IF取得（ISSN → 2yr_mean_citedness）
  │   │   ├─ db-detector.ts: アブストからDB名・研究デザイン・研究カテゴリ検出
  │   │   ├─ Google Translate: タイトル・アブストラクトの日本語訳
  │   │   └─ abstract空の場合: タイトル訳のみ実行、検出・分類はスキップ
  │   └─ data/papers.json に追記（重複排除済み）
  ├─ npx tsx scripts/fetch-rss.ts
  │   └─ PMDA RSS (rss_015.xml) → RWDキーワードフィルタ → data/news.json
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

# 既存論文の日本語訳を一括付与
npx tsx scripts/translate-papers.ts
```

## 現在の状態（2026-03-15）

### 完了済み（Phase 1 MVP）
- [x] Next.js プロジェクト初期化 + Static Export
- [x] データファイル作成（databases.json, db-keywords.json, commercial-db-links.json）
- [x] sync-pubmed.ts 作成・実行済み（101件収集、DB検出率72%、IF取得率99%）
- [x] fetch-rss.ts 作成・実行済み
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

### 完了済み（Phase 1.6: 日本語訳）PR #4 マージ済み
- [x] 論文タイトル・アブストラクトに日本語訳を併記
- [x] Google Translate 無料エンドポイントによる自動翻訳
- [x] translate-papers.ts 作成（既存論文一括翻訳）
- [x] sync-pubmed.ts に翻訳を統合（新規論文は取得時に自動翻訳）
- [x] 日本語訳のフォントサイズを原文より1-2ポイント小さく調整（視認性確保）
- [x] Paper型に `title_ja`, `abstract_ja` フィールド追加

### 完了済み（Phase 1.7: 不完全論文の自動更新）PR #5 マージ済み
- [x] PubMed MedlineCitation Status をパース・保存
- [x] abstract空 or MeSH未付与の論文を月1回自動再取得
- [x] MEDLINE/PubMed-not-MEDLINE ステータスで再取得終了判定
- [x] 再取得時に DB検出・カテゴリ分類・日本語訳を再実行
- [x] abstract空の新規論文はタイトル訳のみ実行（検出・分類スキップ）
- [x] Paper型に `medline_status`, `last_updated` フィールド追加
- [x] 収集頻度を毎日→毎週月曜に変更（カタログサイトとしての性質に合わせ）

### 完了済み（Phase 1.8: ニュースフィード修正）PR #6, #7 マージ済み
- [x] PMDA RSSを英語版(rss_001.xml/空)から日本語版(rss_015.xml/50件)に変更
- [x] PMDA全カテゴリ統合フィードにRWDキーワードフィルタ適用（6件抽出）
- [x] medRxiv削除（論文プレプリントでありニュースとしては不適切）
- [x] ダッシュボード・ニュースページにJMDC・MDVの外部リンクを追加
  - JMDC/MDVはスクレイピング・RSS再配布の利用規約リスクがあるためリンクのみ
- [x] リアルワールドデータ株式会社を削除（JMDCに事業譲渡済み）
- [x] 商業DBリンク先をDB事業トップページに変更（JMDC: phm-jmdc.com, MDV: mdv.co.jp/ebm/）

### 未実装（Phase 2）
- [ ] Pagefind 全文検索
- [ ] SJR CSV 取り込み（`scripts/import-sjr.ts`）→ より正確なQ1-Q4判定
- [ ] DB詳細ページ（/databases/[slug]）の充実（比較表等）
- [ ] 研究カテゴリの検出率向上（現在83%、「その他」17件のパターン追加）

## 既知の課題・注意点

1. **DB検出率 72%**: `data/db-keywords.json` のパターン追加で改善可能。未検出論文は `databases_used: []` のまま
2. **研究カテゴリ検出率 83%**: 17件が「その他」。アブストがない論文（3件）は分類不可。残り14件はパターン辞書の追加で改善可能
3. **papers.json のスケール**: 現在101件。年500件×5年=2,500件、約5MBまでは問題なし
4. **GitHub Actions cron**: 毎週月曜 17:00 UTC（02:00 JST）に実行。初回自動実行の確認推奨
5. **Node.js バージョン**: ローカルは v25.8.1、GitHub Actions は v22。互換性に注意
6. **sync-pubmed.ts の関数重複**: `matchPatterns` / `countPatternMatches` が `db-detector.ts` と重複。TSモジュール制約（`@/` パスエイリアスがスクリプトで使えない）のため意図的な重複
7. **Google Translate 無料エンドポイント**: レート制限あり。大量翻訳時は300msの遅延を挿入。将来的に利用不可になる可能性あり
8. **PMDA RSS (rss_015.xml)**: 全カテゴリ統合フィード（50件）。RWDキーワードフィルタで関連ニュースのみ抽出
9. **商業DB各社のニュース**: JMDC/MDVは利用規約上、RSSの再配布・HTMLスクレイピングにリスクがあるため外部リンクのみ掲載

## 法的リスク評価（ニュースソース）

| ソース | 方式 | リスク | 根拠 |
|--------|------|--------|------|
| PMDA | RSS | 非常に低い | PDL 1.0（政府オープンデータライセンス）。出典明記で利用可 |
| JMDC | 外部リンクのみ | なし | 利用規約がサイト情報の他サイト転載を広く禁止 |
| MDV | 外部リンクのみ | なし | 利用規約で書面承認なき複製・再掲載を明示的に禁止 |

## デバッグTips

### ビルドエラー
```bash
# キャッシュクリアして再ビルド
rm -rf node_modules .next out && npm install && npm run build
```

### 論文収集のテスト
```bash
# sync-pubmed.ts は実行するたびに:
# 1. 不完全論文（abstract空/MeSH未付与）を再取得（月1回）
# 2. 新着論文を追加（既存と重複しないPMIDのみ）
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
PMDA rss_015.xml（全カテゴリ統合フィード）にRWDキーワードフィルタを適用。

### 不完全論文の再取得ロジック
- `sync-pubmed.ts` の `main()` 冒頭で不完全論文を検出・再取得
- 対象: `medline_status` が `Publisher` or `In-Process`（or undefined）かつ収集から180日以内
- 再取得頻度: 30日に1回（`last_updated` で制御）
- `MEDLINE` → MeSH付与済み、再取得不要
- `PubMed-not-MEDLINE` → MeSHが付与されない論文、再取得停止

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
| MedlineCitation Statusで再取得制御 | MeSH未付与(In-Process/Publisher)のみ再取得、MEDLINE到達で停止、PubMed-not-MEDLINEは諦め。無駄なAPI呼び出しを回避 |
| JMDC/MDVはリンクのみ | 利用規約上RSS再配布・スクレイピングにリスクがあるため、外部リンクのみ掲載 |
| 週1回の収集頻度 | カタログサイトとして正確性を重視。新着速報よりも完全なメタデータ（abstract・MeSH付き）を優先 |
