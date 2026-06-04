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
| `data/papers.json` | 論文メタデータ（903件、全件分類済み） |
| `data/false-positives.json` | 削除予定の偽陽性論文リスト（23件） |
| `data/databases.json` | RWDデータベース情報（6件） |
| `data/db-keywords.json` | DB名・研究デザイン・研究カテゴリ検出用キーワード辞書 |
| `docs/classification.md` | **分類スキーマ・再開手順・スクリプト** |
| `docs/DEVELOPMENT.md` | デバッグTips・設計判断・検索式比較・法的リスク・変更履歴 |

## よく使うコマンド

```bash
npm run dev                              # 開発サーバー
npm run build                            # 静的エクスポート → out/
npx tsx scripts/sync-pubmed.ts           # 論文収集（手動）
npx tsx scripts/fetch-rss.ts             # RSS取得（手動）
```

## 現在の状態（2026-06-04）

**Track 1 完了: 全903件の再分類が完了**
- 偽陽性23件（`data/false-positives.json`）→ 削除 & `haiku_classified` → `classified` リネーム待ち
- 週次sync再開待ち（`.github/workflows/daily-sync.yml` のcronコメント解除）

**次（Track 2: 作業フロー見直し）**:
1. 偽陽性削除 + フラグ名リネーム
2. PubMed収集に `hasabstract` フィルター追加
3. 週次sync再開（cronコメント解除）
4. Claude Routines で分類・翻訳を自動化
5. 反映 → Vercel自動リビルド

**未実装（Phase 3）**: Pagefind全文検索 / SJR CSV取込 / DB詳細ページ充実

## 既知の課題

1. **フラグ名リネーム**: `haiku_classified` → `classified`（歴史的経緯による命名）
2. **Google Translate無料EP**: 非公式のため将来停止リスクあり
3. **sync-pubmed.tsの関数重複**: `db-detector.ts`と重複（`@/`パスエイリアスがスクリプトで使えないため意図的）
