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
| `scripts/sync-pubmed.ts` | PubMed収集（収集専任: hasabstract + OpenAlex IF/トピック → classified:false で追記）。分類・翻訳はしない |
| `scripts/backfill-openalex.ts` | 既存論文にOpenAlexのトピック・欠けているIFを補う（`--all` で全件取り直し。冪等） |
| `data/papers.json` | 論文メタデータ（1,085件、全件分類済み）。週次Routineが追記・削除する。`openalex_topics` は関連度つきトピック（OpenAlex由来・CC0） |
| `data/topic-areas.json` | **トピック→診療分野の辞書**（25分野／679トピック）。診療分野の軸はここが正 |
| `lib/clinical-areas.ts` | 論文の診療分野を求める（辞書引き＋スコア閾値0.10）。設計判断はここのコメントに集約 |
| `data/sync-status.json` | 同期の最終実行状況（Routineが毎回更新、`/status`で表示） |
| `data/databases.json` | RWDデータベース情報（10件。`paper_tag` で論文側の名前と突き合わせる） |
| `docs/routine-classify.md` | **Routineのプロンプト全文＋セットアップ手順** |
| `docs/classification.md` | **分類スキーマ・偽陽性基準（Routineが参照する正）** |
| `docs/DEVELOPMENT.md` | デバッグTips・設計判断・検索式比較・法的リスク・変更履歴 |
| `docs/related-papers.md` | 関連研究の設計判断・ブラインド評価の結果・不採用案の記録 |
| `lib/related-papers.ts` | 関連研究の算出（英語本文のBM25コサイン＋タグ加点、ビルド時計算） |
| `lib/papers-url-state.ts` | 研究カタログの絞り込み状態 ⇄ URLクエリの変換 |
| `lib/papers-search.ts` | キーワード検索（スペース区切り＝AND、表記ゆれ正規化、英数字は語境界一致） |
| `lib/favorites.ts` | お気に入り（localStorage のみ。サーバ・アカウント不要） |
| `lib/nav-items.ts` | ヘッダーのナビ項目（デスクトップ・モバイルで共有） |

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

**研究カタログのUX改修 完了（PR #32–#34 / 2026-08）**
絞り込み状態のURL化・AND検索・ファセット件数の動的化・モバイルのドロワー化・
DB一覧の拡充（10件）・お気に入り（localStorage）。
**経緯と設計判断、UIの検証手順は `docs/DEVELOPMENT.md` を参照。**

**診療分野の軸（2026-08）**
OpenAlex のトピック（`topics`、関連度つき最大3件。CC0・singletonは課金対象外）を
`data/topic-areas.json` の辞書で日本の診療科25分野に写像し、絞り込み軸にしている
（1,085件中940件＝87%に付与、平均1.39分野）。

**`openalex_subfield` は使わない。** OpenAlex 側のトピック→subfield 写像が誤っており
（`Gastric Cancer Management and Outcomes` の親が `Pulmonary and Respiratory Medicine`）、
subfield「呼吸器」82件の半分が胃癌・前立腺癌・大動脈だった。単一ラベルしか持てない点も
「乳がん患者の眼有害事象＝乳腺＋眼科」を表せず不適。データには残してあるが参照していない。

第2トピック以降は 0.10 以上のときだけ採る。閾値なしだと `膠原病・リウマチ` が
26→73件に膨らみ、増えた分は無関係な論文だった。**関連研究の重み付けでは閾値を使わず
スコアを係数にすること**（低スコアが自動的に効かなくなる）。

**未実装**: Pagefind全文検索 / SJR CSV取込 / DB詳細ページ充実

## 既知の課題

1. （解消）~~Google Translate無料EP~~ → 翻訳・要約はRoutine(LLM)に移管し廃止。
2. `/papers` の初回表示が重い（brotli後 705KB）。全件の抄録を載せているため
   （抄録だけで生JSONの58%）。検索精度とのトレードオフで現状維持と判断。
   一覧で使わないフィールド9つは `app/papers/page.tsx` で落としてある（736KB→705KB）。
3. （解消）~~詳細ページの「関連研究」が実質「同じDBの最新5件」~~ → 本文ベースの
   類似度（BM25＋タグ加点）に置き換え済み。`lib/related-papers.ts`。
   経緯とブラインド評価の結果は `docs/related-papers.md`。
