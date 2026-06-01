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
| `data/papers.json` | 論文メタデータ（890件、445件分類済み） |
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

## 現在の状態（2026-06-01）

**完了済み**: MVP全ページ / 日本語訳併記 / 不完全論文自動更新(MedlineCitation Status活用) / ニュースフィード(PMDA RSS + JMDC・MDV外部リンク) / RWD社削除(JMDC事業譲渡済み) / PubMed APIレート制御修正(PR#8) / 分類スキーマ確定（下記参照）

**進行中（Track 1: 既存論文の再分類）**:
- Claude Codeの会話モデル（サブエージェント方式）で全890件を再分類中
- **進捗: 445/890件完了（50.0%）、残り445件**
- サブエージェント用プロンプト: `/tmp/medrwd-agent-prompt.md`（セッション間で消える可能性あり。下記「分類スキーマ」セクションに同等内容を記載）
- 数日に分散して処理予定（1バッチ20件、トークン消費を分散）
- 全件完了後に偽陽性論文を一括削除 → gitコミット

**次のマイルストーン（Track 2: 作業フロー見直し）**:
Track 1完了後に以下の新ワークフローを導入：
1. **PubMed収集の改善**: 現行クエリに `hasabstract` フィルターを追加し、アブストラクト付き論文のみ収集
2. **Claude Routines導入**: 分類・翻訳処理をClaude Routinesで自動化
3. **反映**: 分類結果をdata/papers.jsonに反映 → Vercel自動リビルド

**未実装（Phase 3）**: Pagefind全文検索 / SJR CSV取込(正確なQ1-Q4判定) / DB詳細ページ充実

## 削除予定の偽陽性論文（14件）

Track 1完了後に `data/papers.json` から一括削除する。日本のヒトを対象としたRWDデータベース研究ではないもの：

| PMID | 理由 |
|------|------|
| 42036132 | マウス研究 |
| 41780342 | ウズベキスタンの研究 |
| 41777420 | 計量書誌学 |
| 41728845 | 韓国の研究 |
| 41712447 | 鶏マレック病ウイルス |
| 41486034 | 正誤表（原著なし） |
| 41622379 | レター（原著なし） |
| 41056024 | コメンタリー（原著なし） |
| 41533061 | mIBG画像診断研究（「NDB」= normal database、国保DBではない） |
| 41698730 | 住民前向きコホート（LIFE Study、レセプトDB研究ではない） |
| 41626537 | 住民前向きコホート（食事調査、レセプトDB研究ではない） |
| 41450895 | 6カ国横断研究（日本単独のRWD研究ではない） |
| 41431491 | 屋内測位システム研究（RWDデータベース研究ではない） |
| 41414809 | 米国FRIENDレジストリ参照（日本のRWD DBではない） |

## 分類スキーマ（確定版 2026-06-01）

論文の `haiku_classified: true` フラグで分類済みかを判定。

### study_design（1つ選択）

| 値 | 説明 |
|---|---|
| `後方視的コホート研究` | 後方視的コホート、データベース研究、レセプト分析 |
| `横断的研究` | 横断研究、有病率調査（RWDを使用するもの） |
| `症例対照研究` | 症例対照研究 |
| `その他` | プロトコル論文、方法論論文、レビュー、メタアナリシス等 |

※ RWDデータベース研究に「前向きコホート」は存在しない。住民コホート研究は偽陽性。

### research_categories（1〜3つ選択）

| 値 | 説明・含む範囲 |
|---|---|
| `治療実態・処方パターン` | 薬剤に限らず、手術・リハビリ等あらゆる治療の実態・利用動向 |
| `安全性・副作用` | 薬剤の副作用、手術合併症、リスクスコアリング等、あらゆる治療の安全性 |
| `治療効果・有効性` | 薬剤の比較効果、外科的転帰、死亡率、予後等、あらゆる治療の効果 |
| `疾病負荷・自然歴` | 発生率、有病率、疾病負荷、自然歴、疫学全般 |
| `医療資源利用・経済評価` | コスト、在院日数、資源利用、経済評価 |
| `医療の質・アクセスの格差` | 医療の質指標、地域格差、アクセス |
| `方法論・バリデーション` | アルゴリズム検証、DB妥当性検証、方法論的研究 |
| `その他` | 上記に該当しない |

### analysis_methods（該当するもの全て、なければ空配列）

| 値 | 説明 |
|---|---|
| `回帰分析` | ロジスティック回帰、線形回帰、多変量解析を含む |
| `生存時間分析` | Kaplan-Meier、Cox比例ハザード、競合リスク分析を含む |
| `傾向スコア (PSM/IPTW)` | 傾向スコアマッチング、IPTW |
| `不均衡分析（ROR/PRR等）` | JADER/FAERS等のシグナル検出 |
| `中断時系列分析 (ITS)` | 政策変更・介入前後の時系列分析 |
| `機械学習・AI` | ランダムフォレスト、ニューラルネット等 |
| `メタアナリシス` | メタアナリシス、ネットワークメタアナリシス |
| `差分の差分法 (DID)` | Difference-in-differences |
| `ターゲットトライアルエミュレーション` | Target trial emulation |
| `操作変数法` | Instrumental variable analysis |
| `自己対照ケースシリーズ (SCCS)` | Self-controlled case series |

※ 記述統計・サブグループ解析は弁別力がないため選択肢から除外。空配列 = 特筆すべき高度な手法なし。

### databases_used（既知DBリスト）

`NDB` / `NDBオープンデータ` / `DPC` / `JADER` / `MID-NET` / `JMDC` / `MDV` / `NCD` / `DeSC Healthcare` / `KDB`

※ DB名不明の場合は `databases_used: []` とし `additional_data_sources` に説明を記載。NCD ≠ NDB。

### 偽陽性判定基準

動物実験 / 日本以外の国の研究 / 計量書誌学 / レター・コメンタリー・正誤表 / 純粋な画像診断研究 / 住民前向きコホート研究

## 検索式の比較調査（2026-03-18実施）

直近1年の論文で検索式を比較（詳細: `data/query-comparison.xlsx`）：

| 式 | 説明 | ヒット | DB検出率 |
|----|------|--------|---------|
| A: 現行 | DB名6種 + Japan + 研究用語 | 373 | 79.1% |
| J: 改良 | A + Japan[tiab]厳密化 + NOT RCT | 362 | 82.9% |
| L: 広め | DB名 + RWD用語 + Japan厳密 + NOT RCT | 846 | 35.2% |

**結論**: 検索式だけでは「網羅性 vs 精度」のジレンマを解消できない。広め検索(式L) + AI精密判定 の2段階方式を採用予定。

## 既知の課題

1. **再分類未完了**: 890件中445件が分類済み。残り445件をサブエージェント方式で処理中（数日に分散）
2. **Google Translate無料EP**: 非公式EPのため将来停止リスクあり。Claude Routines導入時に置換予定
3. **sync-pubmed.tsの関数重複**: `matchPatterns`等が`db-detector.ts`と重複（`@/`パスエイリアスがスクリプトで使えないため意図的）
4. **Node.js**: ローカル v25.8.1 / GitHub Actions v22

## 法的リスク評価

| ソース | 方式 | リスク | 根拠 |
|--------|------|--------|------|
| PMDA | RSS | 非常に低い | PDL 1.0。出典明記で利用可 |
| JMDC/MDV | 外部リンクのみ | なし | 利用規約で転載・スクレイピング禁止のため |

詳細は → [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)（デバッグTips・設計判断・変更履歴）
