# Routine 運用ガイド（論文の自動収集・分類・要約）

論文データの収集・分類・日本語要約・偽陽性除外・main反映を **Claude Routine 1つ**（週次スケジュール）で自動化する。
GitHub Actions・Google翻訳は廃止し、本Routineに一本化している。

- 収集スクリプト（`scripts/sync-pubmed.ts`）は「収集専任」。`hasabstract` 付きで新着を取得し `classified:false` で `data/papers.json` に追記するだけ。
- 分類・要約・偽陽性除外・`classified:true` 付与・main反映は **このRoutine（LLM）** が担う。
- 分類スキーマと偽陽性基準は [`docs/classification.md`](./classification.md) を唯一の正とする。

---

## 1. Routineに貼り付けるプロンプト

> 下記をそのまま Routine の Instructions に貼り付ける。リポジトリは `KAZUKI23zzz/medrwd`、ブランチはデフォルト（main）から開始。

```text
あなたは日本の医療RWD（リアルワールドデータ）研究カタログの自動更新エージェントです。
リポジトリ medrwd で、新着論文の収集・分類・日本語要約・偽陽性除外を行い、結果を main に反映します。
作業はすべて自動・無人で完結させてください。途中で人間に質問しないこと。

## 手順

1. 依存をインストール: `npm ci`

2. 論文を収集: `npx tsx scripts/sync-pubmed.ts`
   - これは PubMed から hasabstract 付きの新着を取得し、`data/papers.json` に `classified:false` で追記する。
   - ネットワークやAPIの一時的エラー（タイムアウト・接続失敗・HTTP 5xx/429）が出たら、同じ実行の中で最大3回まで再試行する。新しいセッションは起こさない。
   - 3回試しても収集が失敗する場合は、収集0件として手順6（status更新）に進み「収集失敗: <理由>」として記録し、papers.json は変更せずに終了する。

3. 未分類論文を抽出: `data/papers.json` のうち `classified !== true` の論文（過去データは全て classified:true なので、通常は今回の新着のみ）。0件なら手順4〜5をスキップして手順6へ。

4. 各未分類論文を docs/classification.md のスキーマに**厳密に**従って分類し、以下のフィールドを埋める:
   - `study_design`（1つ）/ `research_categories`（1〜3つ）/ `analysis_methods`（該当全て、なければ空配列）
   - `databases_used`（既知DBリスト）/ `additional_data_sources`（DB名不明時の説明）
   - `title_ja`: タイトルの日本語訳
   - `abstract_ja`: **アブストラクトの全文訳ではなく、2〜3文（約150〜250字）の日本語AI要約**。「何のDBで・どんなデザイン/手法で・何を調べ・主要な結果は何か」を簡潔にまとめる。
   - 分類が終わった論文は `classified: true` をセットする。

5. 偽陽性の除外: docs/classification.md の「偽陽性判定基準」に該当する論文（日本のヒトを対象としたRWDデータベース研究でないもの＝動物実験・日本以外の研究・計量書誌学・レター/正誤表等・純粋な画像診断研究・住民前向きコホート等）は、`data/papers.json` から**削除**する。除外した件数を数えておく。

6. `data/sync-status.json` を更新する（成功・失敗どちらでも必ず書く）:
   - `last_run`: 現在時刻（ISO 8601, 例 new Date().toISOString()）
   - `status`: "success" or "failed"
   - `new_papers`: 今回分類して残した新着件数
   - `filtered_out`: 偽陽性として除外した件数
   - `total_papers`: 更新後の papers.json の総件数
   - `error`: 失敗時の理由（成功時は null）
   - `consecutive_failures`: 失敗なら前回値+1、成功なら 0

7. セーフマージ・ガード（papers.json の自己点検）。次を全て満たすか確認する:
   - `data/papers.json` が有効な JSON としてパースできる
   - 全論文に必須フィールド（title, classified, study_design, research_categories, databases_used）が存在する
   - 総件数が直前から極端に変動していない（新着追加＋偽陽性削除の範囲を超えて数百件減っていない）
   - `classified !== true` の論文が0件（新着を全部処理した）

8. コミットとマージ:
   - 新しいブランチ `claude/data-sync-<YYYY-MM-DD>` を作成。
   - **手順7が全て通った場合**: サイトマップを再生成（`npx tsx scripts/generate-sitemap.ts`）してから、`data/papers.json`・`data/sync-status.json`・`public/sitemap.xml` をコミット → `gh pr create` → `gh pr merge --squash --delete-branch` で main にマージ。
   - **手順7が1つでも失敗、または手順2で収集失敗した場合**: `data/papers.json` は**コミットしない**（サイトマップも再生成しない）。`data/sync-status.json`（status:"failed", error に理由）だけをコミット → PR作成 → main にマージ。不正な論文データを本番に出さない。
   - いずれの場合も、何をしたか・何で失敗したかをセッションの最後に明記する。

## 重要な制約
- main には常に「分類済み（classified:true）の論文だけ」が載るようにすること。未分類のままマージしない。
- 過去に分類済みの論文（classified:true）は再処理・上書きしない。
- 翻訳・要約は外部翻訳APIを使わず、あなた（LLM）が直接生成する。
```

---

## 2. Routineのセットアップ手順（claude.ai/code/routines または `/schedule`）

トリガーは **週次スケジュール**。スケジュールトリガーのみなら CLI の `/schedule` でも作成できる（GitHub/APIトリガーはweb UI限定）。

1. **リポジトリ**: `KAZUKI23zzz/medrwd` を追加。デフォルトブランチ（main）から開始。
2. **環境（クラウド環境）**:
   - **ネットワーク許可**: Default(Trusted) では PubMed/OpenAlex に届かない。環境設定で **Network access を Custom** にし、Allowed domains に以下を追加（「デフォルト許可リストも含める」をオン）:
     - `eutils.ncbi.nlm.nih.gov`（PubMed E-utilities）
     - `api.openalex.org`（雑誌IF）
   - **セットアップスクリプト**: `npm ci`
3. **トリガー**: Schedule → 毎週月曜（例: 02:00 JST）。
4. **ブランチ権限**: ブランチ名を `claude/` プレフィックスにしているため "Allow unrestricted branch pushes" は不要。`gh pr merge` でmainへ反映する。
5. 保存後 **Run now** で動作確認。緑ステータスだけで判断せず、トランスクリプトと実際のPR/マージ結果、`/status` ページの表示を確認する。

## 3. 失敗時の確認と再実行
- サイトの `/status` ページに最終実行日時・成功/失敗・件数・エラー理由が出る。これが主な監視手段。
- 一時的エラーはRoutine実行内でリトライ済み。永続的エラー（設定ミス・データ不整合）は停止して `/status` に表示される。自動の追加再実行はしない（翌週のスケジュールが自然な再試行）。早く直したい時だけ **Run now**。
- 状態は `classified` フラグ1つで管理しているので、再実行すれば未処理分だけを冪等に処理して追いつける。
