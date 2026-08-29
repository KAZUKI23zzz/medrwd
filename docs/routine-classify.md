# Routine 運用ガイド（論文の自動収集・分類・要約）

論文データの収集・分類・日本語要約・偽陽性除外・main反映を **Claude Routine 1つ**（週次スケジュール）で自動化する。
GitHub Actions・Google翻訳は廃止し、本Routineに一本化している。

**役割分担**

| | 担当 | 内容 |
|---|---|---|
| 収集 | `scripts/sync-pubmed.ts` | PubMed検索 → 収集済み・除外済みを落とす → 上限まで詳細取得 → OpenAlexのCI/トピック付与 → `classified:false` で追記 |
| 分類・要約・偽陽性除外 | **Routine（LLM）** | `docs/classification.md` に従って判断する |
| 自己点検 | `scripts/validate-papers.ts` と `npm run build` | 合否は機械が決める。Routineはコマンドを打つだけ |
| main反映 | **Routine（LLM）** | PRは作らず直接push |

**収集スクリプトの設定**（Routineは意識しなくてよい）

- 検索窓 **90日**。`hasabstract` で絞るため、アブストラクトが後から付いた論文を拾うには
  窓が要る（14日では実測で9件取りこぼしていた）。
- 検索結果の**件数上限なし**。以前は100件で切っており、PubMedが新しい順に返すため
  古い側を静かに捨てていた。いまは取りこぼしを検出して例外にする。
- 1回の取り込みは**最大50件**（古い順）。あふれた分は翌週。ここがLLMの作業量を決める。
- `data/papers.json` と `data/excluded-pmids.json` の両方で除外する。

**分類スキーマと偽陽性基準は [`docs/classification.md`](./classification.md) が唯一の正。**

---

## 1. Routineに貼り付けるプロンプト

> 下記をそのまま Routine の Instructions に貼り付ける。リポジトリは `KAZUKI23zzz/medrwd`、ブランチはデフォルト（main）から開始。

```text
あなたは日本の医療RWD（リアルワールドデータ）研究カタログの自動更新エージェントです。
リポジトリ medrwd で新着論文の分類・日本語要約・偽陽性除外を行い、結果を main に反映します。
無人で完結させること。途中で人間に質問しない。

## 手順

1. `npm ci`

2. 収集: `npx tsx scripts/sync-pubmed.ts`
   PubMedから新着を取得し `classified:false` で `data/papers.json` に追記する。
   収集済み・除外済みの論文は自動で除かれ、1回あたりの取り込み数にも上限がある。
   あふれた分は翌週に回るので、追いかけなくてよい。
   - 一時的エラー（タイムアウト・接続失敗・HTTP 5xx/429）は同じ実行の中で最大3回まで再試行。
     新しいセッションは起こさない。
   - 3回とも失敗したら収集0件として手順5へ進み、`error` に「収集失敗: <理由>」を記録。
     `data/papers.json` は変更しない。

3. 分類: `classified !== true` の論文を **docs/classification.md に厳密に従って**分類し、
   `classified: true` を付ける。0件なら手順4を飛ばす。
   スキーマ（フィールドの型・選択肢・配列の規則・`abstract_ja` の書き方・偽陽性基準）は
   classification.md が唯一の正。ここには書かないので必ず読むこと。
   - **選択肢は表にある値をそのまま使う。** 言い換えたり細かくしたりしない
     （「ロジスティック回帰」ではなく「回帰分析」）。手順6で弾かれる。
   - **`openalex_*` は触らない。** 収集スクリプトが埋める。とくに `openalex_topics` は
     診療分野の絞り込み軸と関連研究の並び順の元なので、壊すと両方が黙って効かなくなる。
     取得できなかった場合に入っている `null` が正しい状態。
   - **スキーマに無いフィールドを足さない。**

4. 偽陽性の除外: classification.md の「偽陽性判定基準」に該当する論文を
   `data/papers.json` から**削除**し、そのPMIDを `data/excluded-pmids.json` の
   `pmids` に追記する。追記しないと翌週また拾って分類してしまう。除外件数を数えておく。

5. `data/sync-status.json` を更新（成功・失敗どちらでも必ず書く）:
   `last_run`（ISO 8601）/ `status`（"success" | "failed"）/ `new_papers`（今回残した新着数）/
   `filtered_out`（除外数）/ `total_papers`（更新後の総件数）/ `error`（失敗理由。成功時 null）/
   `consecutive_failures`（失敗なら前回値+1、成功なら 0）

6. 自己点検:
   - `npx tsx scripts/validate-papers.ts` が終了コード0。目視で代替しない。
   - `npm run build` が成功する（型崩れはここで初めて顕在化する。2026-07-13にこれを
     怠り本番デプロイが5週間停止した）。
   - 総件数が直前から極端に減っていない。

   **validate-papers が失敗したら、次の順に対処する:**

   (1) 直す（最大2回）。エラーは論文IDとフィールド名を名指しするので、該当の論文だけを
       直す。直してよいのはあなたが手順3で書いたフィールドのみ。`openalex_*` と
       収集スクリプトが書いたフィールドは触らない。**値を空にして回避しない。**
       正しい値を入れられないなら (2) へ。
   (2) 2回試して直らない論文だけを `data/papers.json` から取り除き、残りはコミットする。
       **`excluded-pmids.json` には入れない**（対象ではあるので翌週やり直す。入れると
       二度と収録されなくなる）。取り除いたPMIDを `sync-status.json` の `error` に
       「分類できず保留: <PMID>」として記録する。

   **`npm run build` の失敗は修正対象外。** データ以外が原因のこともあるので、
   落ちたら手順7の失敗経路へ進む。

7. main へ反映（`gh` CLI は無い。**セッション組み込みのGitHubツール**を使う。PRは作らず直接push）:
   - **手順6を満たした場合**: `npx tsx scripts/generate-sitemap.ts` を実行してから
     `data/papers.json`・`data/excluded-pmids.json`・`data/sync-status.json`・
     `data/unknown-topics.json`・`public/sitemap.xml` を main に直接コミット・push。
     `unknown-topics.json` は収集スクリプトが書き換える待ち行列。**中身を編集しない**
     （分野の判断は人がやる）。
   - **満たさなかった場合、または手順2で収集失敗した場合**: `data/sync-status.json` だけを
     コミット・push（papers.json 系はコミットせず、サイトマップも再生成しない）。
     不正なデータを本番に出さない。
   - 権限エラー（403等）は `sync-status.json` の `error` に記録して終了（握りつぶさない）。
   - 最後に、何をしたか・何で失敗したかを明記する。

## 制約
- main には分類済み（`classified:true`）の論文だけを載せる。
- 分類済みの論文は再処理・上書きしない。
- 翻訳・要約は外部APIを使わず、あなた（LLM）が直接生成する。
```

---

## 2. Routineのセットアップ手順（claude.ai/code/routines または `/schedule`）

トリガーは **週次スケジュール**。スケジュールトリガーのみなら CLI の `/schedule` でも作成できる（GitHub/APIトリガーはweb UI限定）。

1. **リポジトリ**: `KAZUKI23zzz/medrwd` を追加。デフォルトブランチ（main）から開始。
2. **GitHub App の書き込み権限（必須・最重要のハマりどころ）**: クラウドセッションが push・PR・マージするには、Claude GitHub App をリポジトリに **write 権限**で入れる必要がある。無いと収集が成功しても 403 で main に反映できない。
   - https://github.com/apps/claude → Configure → アカウント `KAZUKI23zzz` → **medrwd（または All repositories）** を選択。
   - 権限に **Contents: Read and write** と **Pull requests: Read and write** が含まれること（既定で付く）。
   - ※ クローンだけなら read アクセスでも動くが、push/マージには write が必須。
3. **環境（クラウド環境）**:
   - **ネットワーク許可（必須）**: Default(Trusted) では PubMed/OpenAlex に届かず収集が 403 で失敗する。環境設定で **Network access を Custom** にし、Allowed domains に追加（「デフォルト許可リストも含める」をオン）:
     - `eutils.ncbi.nlm.nih.gov`（PubMed E-utilities）
     - `api.openalex.org`（雑誌IF・トピック）
   - **セットアップスクリプト**: `npm ci`
4. **トリガー**: Schedule → 毎週月曜（例: 02:00 JST）。
5. **ブランチ**: 週次同期は main へ直接pushする（PRは作らない）。mainにブランチ保護は掛けていない。
6. 保存後 **Run now** で動作確認。緑ステータスだけで判断せず、トランスクリプトと実際のPR/マージ結果、`/status` ページの表示を確認する。

## 3. 失敗時の確認と再実行
- サイトの `/status` ページに最終実行日時・成功/失敗・件数・エラー理由が出る。これが主な監視手段。
- 一時的エラーはRoutine実行内でリトライ済み。永続的エラー（設定ミス・データ不整合）は停止して `/status` に表示される。自動の追加再実行はしない（翌週のスケジュールが自然な再試行）。早く直したい時だけ **Run now**。
- 状態は `classified` フラグ1つで管理しているので、再実行すれば未処理分だけを冪等に処理して追いつける。
