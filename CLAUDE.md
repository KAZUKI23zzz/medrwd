# MedRWD Japan

日本の医療RWD研究を「どのDBで・どんな手法で・何を調べたか」で検索できるカタログサイト。

- **本番URL**: https://medrwd-f553wm4wi-kazuki23zzzs-projects.vercel.app
- **GitHub**: https://github.com/KAZUKI23zzz/medrwd
- **設計原則**: 無料・低メンテナンス・合法（公式API/RSS/公開情報のみ）

## 技術スタック

Next.js 16 (Static Export) / TypeScript / Tailwind CSS v4 + shadcn/ui v4 / JSON（DBなし） / GitHub Actions cron（毎週月曜） / Vercel Hobby

## 主要ディレクトリ

| パス | 役割 |
|------|------|
| `app/` | Next.js App Router（ダッシュボード・研究カタログ・DB一覧・ニュース・About） |
| `scripts/sync-pubmed.ts` | PubMed収集 + OpenAlex IF + DB検出 + カテゴリ分類 + 日本語訳 + 不完全論文再取得 |
| `scripts/fetch-rss.ts` | PMDA RSS → RWDキーワードフィルタ → news.json |
| `scripts/translate-papers.ts` | 既存論文の日本語訳一括付与（手動） |
| `scripts/reclassify-categories.ts` | 既存論文のカテゴリ再分類（手動） |
| `data/papers.json` | 論文メタデータ（101件、日本語訳・カテゴリ付き） |
| `data/databases.json` | RWDデータベース情報（6件：NDB・DPC・JADER・MID-NET・JMDC・MDV） |
| `data/db-keywords.json` | DB名・研究デザイン・研究カテゴリ検出用キーワード辞書 |
| `data/news.json` | PMDAニュース（自動更新） |
| `lib/collectors/db-detector.ts` | アブストからDB名・研究デザイン・カテゴリ検出（正規表現プリコンパイル） |
| `.github/workflows/daily-sync.yml` | 毎週月曜 17:00 UTC: sync-pubmed → fetch-rss → commit → Vercel自動リビルド |

## よく使うコマンド

```bash
npm run dev                              # 開発サーバー
npm run build                            # 静的エクスポート → out/
npx tsx scripts/sync-pubmed.ts           # 論文収集（手動）
npx tsx scripts/fetch-rss.ts             # RSS取得（手動）
npx tsx scripts/reclassify-categories.ts # カテゴリ再分類
npx tsx scripts/translate-papers.ts      # 日本語訳一括付与
```

## データ更新フロー（毎週月曜 02:00 JST）

1. **不完全論文の再取得**（月1回）: MedlineCitation Statusが`Publisher`/`In-Process`の論文を再取得。`MEDLINE`で完了、`PubMed-not-MEDLINE`で停止。180日で諦め。
2. **新着論文の収集**: PubMed esearch（過去14日）→ efetch → OpenAlex IF → DB検出・カテゴリ分類・日本語訳。abstract空の場合はタイトル訳のみ。
3. **PMDA RSS取得**: rss_015.xml（全カテゴリ統合）→ RWDキーワードフィルタ。
4. data/に変更があれば git commit & push → Vercel自動リビルド。

## 現在の状態（2026-03-18）

**完了済み**: MVP全ページ / 研究カテゴリ分類(7カテゴリ) / 日本語訳併記 / 不完全論文自動更新(MedlineCitation Status活用) / ニュースフィード(PMDA RSS + JMDC・MDV外部リンク) / RWD社削除(JMDC事業譲渡済み) / PubMed APIレート制御修正(PR#8)

**次のマイルストーン（Phase 2: Gemini導入）**:
- **Gemini 2.0 Flash（無料枠）** を導入し、現在の正規表現+Google Translateを置き換え
- 1リクエストで **RWD判定・DB検出・研究デザイン・カテゴリ分類・日本語訳** を統合
- PubMed検索式を広めに変更（現行式A → 式L相当）し、Geminiで精密フィルタリング
- これにより DB検出率72%・カテゴリ検出率83% の両方を大幅改善見込み

**未実装（Phase 3）**: Pagefind全文検索 / SJR CSV取込(正確なQ1-Q4判定) / DB詳細ページ充実

## 検索式の比較調査（2026-03-18実施）

直近1年の論文で検索式を比較（詳細: `data/query-comparison.xlsx`）：

| 式 | 説明 | ヒット | DB検出率 |
|----|------|--------|---------|
| A: 現行 | DB名6種 + Japan + 研究用語 | 373 | 79.1% |
| J: 改良 | A + Japan[tiab]厳密化 + NOT RCT | 362 | 82.9% |
| L: 広め | DB名 + RWD用語 + Japan厳密 + NOT RCT | 846 | 35.2% |

**結論**: 検索式だけでは「網羅性 vs 精度」のジレンマを解消できない。広め検索(式L) + AI精密判定 の2段階方式を採用予定。

## 既知の課題

1. **DB検出率 72%**: 正規表現の限界。Gemini導入で解消予定
2. **カテゴリ検出率 83%**: 同上。Gemini導入で解消予定
3. **Google Translate無料EP**: 非公式EPのため将来停止リスクあり。Gemini翻訳で置換予定
4. **sync-pubmed.tsの関数重複**: `matchPatterns`等が`db-detector.ts`と重複（`@/`パスエイリアスがスクリプトで使えないため意図的）
5. **Node.js**: ローカル v25.8.1 / GitHub Actions v22

## 法的リスク評価

| ソース | 方式 | リスク | 根拠 |
|--------|------|--------|------|
| PMDA | RSS | 非常に低い | PDL 1.0。出典明記で利用可 |
| JMDC/MDV | 外部リンクのみ | なし | 利用規約で転載・スクレイピング禁止のため |

詳細は → [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)（デバッグTips・設計判断・変更履歴）
