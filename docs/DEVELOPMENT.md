# 開発者向け詳細ドキュメント

## デバッグTips

### ビルドエラー
```bash
rm -rf node_modules .next out && npm install && npm run build
```

### 論文収集のテスト
```bash
npx tsx scripts/sync-pubmed.ts
cat data/papers.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Total: {len(d)} papers')"
```

### 分類・要約ロジック（2026-06 刷新）
- 分類・日本語要約・偽陽性除外は **週次のClaude Routine** が担当（[`routine-classify.md`](./routine-classify.md)）。
- 分類スキーマ・偽陽性基準は [`classification.md`](./classification.md) が正。変更はそこを編集すればRoutineの判断に反映される。
- `sync-pubmed.ts` は収集専任（`hasabstract` 付き収集＋OpenAlex IF → `classified:false` で追記）。キーワード正規表現分類・Google翻訳・不完全論文の再取得ロジックは廃止済み。
- 旧: `db-keywords.json` 辞書 + `db-detector.ts` プリコンパイル + `reclassify-categories.ts` / `detect-analysis-methods.ts` / `translate-papers.ts`、PMDAニュース（`fetch-rss.ts`）はいずれも削除済み。

## 検索式の比較調査（2026-03-18実施）

直近1年の論文で検索式を比較（当時の詳細Excel `data/query-comparison.xlsx` は整理時に削除済み）：

| 式 | 説明 | ヒット | DB検出率 |
|----|------|--------|---------|
| A: 現行 | DB名6種 + Japan + 研究用語 | 373 | 79.1% |
| J: 改良 | A + Japan[tiab]厳密化 + NOT RCT | 362 | 82.9% |
| L: 広め | DB名 + RWD用語 + Japan厳密 + NOT RCT | 846 | 35.2% |

**結論**: 検索式だけでは「網羅性 vs 精度」のジレンマを解消できない。広め検索(式L) + AI精密判定 の2段階方式を採用予定。

## 法的リスク評価

| ソース | 方式 | リスク | 根拠 |
|--------|------|--------|------|
| PMDA | RSS | 非常に低い | PDL 1.0。出典明記で利用可 |
| JMDC/MDV | 外部リンクのみ | なし | 利用規約で転載・スクレイピング禁止のため |

## アーキテクチャ上の設計判断

| 判断 | 理由 |
|------|------|
| JSON（Supabase不採用） | 7日無活動で休眠。年200-500件でJSON十分 |
| Static Export | DBなし=障害ポイントゼロ。Vercel無料枠で十分 |
| クライアントサイドフィルタ | 5,000件以下ならJSで十分高速 |
| PubMed XML直接パース | 外部ライブラリ不要。構造が安定 |
| RSSの正規表現パース | xml2js等の依存を排除 |
| スコアリング分類 | マッチ数で順位付け → 複数カテゴリ該当時に上位2つに絞れる |
| 正規表現プリコンパイル | 2,500件×7カテゴリ×20パターン=35万回のコンパイルを回避 |
| MedlineCitation Statusで再取得制御 | 無駄なAPI呼び出しを回避 |
| JMDC/MDVはリンクのみ | 利用規約リスク回避 |
| 週1回収集 | カタログとして正確性を重視 |

## 変更履歴

### Phase 1.8: ニュースフィード修正（PR #6, #7）
- PMDA RSS: rss_001.xml(英語版/空) → rss_015.xml(日本語版/50件) + RWDキーワードフィルタ
- medRxiv削除、JMDC/MDV外部リンク追加
- RWD社削除（JMDC事業譲渡済み）、商業DBリンク先をDB事業トップに変更

### Phase 1.7: 不完全論文の自動更新（PR #5）
- MedlineCitation Status パース・保存
- abstract空/MeSH未付与論文を月1回再取得、ステータスで終了判定
- 収集頻度を毎日→毎週月曜に変更

### Phase 1.6: 日本語訳（PR #4）
- タイトル・アブストラクトにGoogle Translate無料EPで日本語訳を併記
- 日本語訳のフォントサイズを1-2pt小さく調整

### Phase 1.5: 研究カテゴリ（PR #2）
- 7カテゴリ＋その他のスコアリング分類機能
- db-keywords.jsonにカテゴリ辞書追加、正規表現プリコンパイル
