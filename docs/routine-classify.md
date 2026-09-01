# Routine 運用ガイド（論文の自動収集・分類・要約）

論文データの収集・分類・日本語要約・偽陽性除外・main反映を **Claude Routine 1つ**（週次スケジュール）で自動化する。
GitHub Actions・Google翻訳は廃止し、本Routineに一本化している。

**役割分担**

| | 担当 | 内容 |
|---|---|---|
| 収集 | `scripts/sync-pubmed.ts` | PubMed検索 → 収集済み・除外済みを落とす → 上限まで詳細取得 → OpenAlexのCI/トピック付与 → `classified:false` で追記 |
| 欠損の補充 | `scripts/backfill-openalex.ts` | トピック・CIが欠けている論文だけ OpenAlex に問い合わせ直す。新しい論文は収載が遅れるため。**自己点検（ビルド）の直前に走らせる**（診療分野と関連研究がこのトピックから決まる） |
| 診療分野・関連研究 | `npm run build` | どちらも保存せず、ビルドのたびに全件を計算する。Routineが指示することは無い |
| 分類・要約・偽陽性除外 | **Routine（LLM）** | `docs/classification.md` に従って判断する |
| 自己点検 | `scripts/validate-papers.ts` と `npm run build` | 合否は機械が決める。Routineはコマンドを打つだけ |
| main反映 | **Routine（LLM）** | 自分のブランチから main への PR を作って squash マージ。**マージ後に着地を確認する** |

**収集スクリプトの設定**（Routineは意識しなくてよい）

- 検索窓 **90日**。`hasabstract` で絞るため、アブストラクトが後から付いた論文を拾うには
  窓が要る（14日では実測で9件取りこぼしていた）。
- 検索結果の**件数上限なし**。以前は100件で切っており、PubMedが新しい順に返すため
  古い側を静かに捨てていた。いまは取りこぼしを検出して例外にする。
- 1回の取り込みは**最大50件**（古い順）。あふれた分は翌週。ここがLLMの作業量を決める。
- `data/papers.json` と `data/excluded-pmids.json` の両方で除外する。
- OpenAlexは新しい論文の収載が遅れる。収集時に取れなくても `backfill-openalex.ts` が
  毎週拾い直すので、後から付いたトピックは自動的に埋まる（診療分野はこれが元になる）。

**分類スキーマと偽陽性基準は [`docs/classification.md`](./classification.md) が唯一の正。**

---

## 1. Routineに貼り付けるプロンプト

> 下記をそのまま Routine の Instructions に貼り付ける。リポジトリは `KAZUKI23zzz/medrwd`、ブランチはデフォルト（main）から開始。
>
> **指示文には「何をするか」だけを書く。「なぜそうするか」はここより下の節と
> `CLAUDE.md` に置く。** 毎回のトークンを食ううえ、長い指示文は一部が読み飛ばされる。
> 判断の根拠を残したくなったら、指示文ではなくリポジトリ側に書くこと。

```text
あなたは日本の医療RWD（リアルワールドデータ）研究カタログの自動更新エージェントです。
リポジトリ medrwd で新着論文の分類・日本語要約・偽陽性除外を行い、main に反映します。
無人で完結させること。途中で人間に質問しない。

## 手順

1. `npm ci`

2. 収集: `npx tsx scripts/sync-pubmed.ts`
   新着を `classified:false` で `data/papers.json` に追記する。取り込み数には上限があり、
   あふれた分は翌週に回るので追いかけなくてよい。
   一時的エラー（タイムアウト・接続失敗・HTTP 5xx/429）は同じ実行の中で最大3回まで再試行。
   3回とも失敗したら収集0件として手順7へ進み、`error` に「収集失敗: <理由>」を記録する。
   `data/papers.json` は変更しない。

3. 分類: `classified !== true` の論文を **docs/classification.md に厳密に従って**分類し、
   `classified: true` を付ける。0件なら手順4を飛ばす。
   スキーマ・選択肢・偽陽性基準は classification.md が唯一の正。必ず読むこと。
   - **選択肢は表の値をそのまま使う**（「ロジスティック回帰」ではなく「回帰分析」）。
   - **`openalex_*` は触らない。** 診療分野と関連研究がこれを元に作られる。
   - **スキーマに無いフィールドを足さない。**

4. 偽陽性の除外: 該当する論文を `data/papers.json` から削除し、そのPMIDを
   `data/excluded-pmids.json` の `pmids` に追記する。追記しないと翌週また拾う。
   除外件数を数えておく。

5. 欠損の補充: `npx tsx scripts/backfill-openalex.ts`
   欠けているトピック・CIを埋める。最大3回まで再試行し、駄目なら
   「補充失敗: <理由>」を控えて手順6へ進む。ここで全体を止めない。

6. 自己点検。次を**全て**満たすこと:
   - `npx tsx scripts/validate-papers.ts` が終了コード0。目視で代替しない。
   - `npm run build` が成功する（型崩れはここで初めて顕在化する。2026-07-13にこれを
     怠り本番デプロイが5週間停止した）。
   - 総件数が直前から極端に減っていない。

   validate-papers が失敗したら:
   (1) 該当の論文だけを直す（最大2回）。直してよいのは手順3で書いたフィールドのみ。
       **値を空にして回避しない。**
   (2) 直らない論文だけを `data/papers.json` から取り除き、残りは進める。
       **`excluded-pmids.json` には入れない**（翌週やり直すため。入れると二度と収録されない）。
       取り除いたPMIDを `error` に「分類できず保留: <PMID>」として記録する。

   `npm run build` の失敗は修正対象外。落ちたら手順8の失敗経路へ進む。

7. `data/sync-status.json` を更新（**自己点検の後**。先に書くと手順6で論文を
   取り除いたときに数字がずれる）。成功・失敗どちらでも必ず書く。
   - `status`: 手順6を全て満たしたときだけ `"success"`。一つでも欠けたら `"failed"`
     （手順2の収集失敗も `"failed"`）。
   - `error`: 成功なら `null`。失敗なら**必ず理由を書く**（空だとビルドが落ちる）。
   - `last_run`(ISO 8601) / `new_papers` / `filtered_out` / `total_papers` /
     `consecutive_failures`（失敗なら前回値+1、成功なら 0）

8. main へ反映（`gh` CLI は無い。組み込みのGitHubツールを使う）:
   - **main へ直接 push しないこと。** このセッションは自分のブランチ以外へ push
     できない。main へ届ける経路は **PR を作ってマージする**ことだけ。
   - **手順6を満たした場合**: `npx tsx scripts/generate-sitemap.ts` を実行し、
     `data/papers.json`・`data/excluded-pmids.json`・`data/sync-status.json`・
     `data/unknown-topics.json`・`public/sitemap.xml` を**いまいるブランチ**に
     コミット・push → main への PR を作成 → **squash でマージする**。
     タイトルは `chore: 週次収集・分類（新着N件・偽陽性M件除外）`。
     `unknown-topics.json` は中身を編集しない。
   - **満たさない場合**: `data/sync-status.json` だけを同じ流れで。他はコミットしない。
   - **マージ後、main の最新コミットに自分の変更が載っていることを確認する。**
     載っていなければ `status` を `"failed"`、`error` を「mainへの反映に失敗: <理由>」に
     直して同じ流れでやり直す。それも駄目なら実行結果に明記して終了。
   - 権限エラー（403等）も `error` に記録して終了（握りつぶさない）。

## 制約
- main には `classified:true` の論文だけを載せる。
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
5. **ブランチ**: セッションは自動生成ブランチにチェックアウトされ、**そこ以外へは push
   できない**（システムプロンプトに注入される規則で、指示文では上書きできない）。
   そのため main へは **PR を作ってマージする**。mainにブランチ保護は掛けていない。
   repo設定「Automatically delete head branches」を ON にしてあるので、
   マージ済みのブランチは自動で消える。
6. 保存後 **Run now** で動作確認。**緑ステータスだけで判断しないこと。**
   Routine の「成功」はセッションが落ちずに終わったという意味でしかなく、
   main に届いたかは見ていない（2026-08-31 は成功表示のまま未反映だった）。
   `main` の最新コミットと `/status` の表示を必ず確認する。

## 3. 失敗時の確認と再実行
- サイトの `/status` ページに最終実行日時・成功/失敗・件数・エラー理由が出る。これが主な監視手段。
- 一時的エラーはRoutine実行内でリトライ済み。永続的エラー（設定ミス・データ不整合）は停止して `/status` に表示される。自動の追加再実行はしない（翌週のスケジュールが自然な再試行）。早く直したい時だけ **Run now**。
- 状態は `classified` フラグ1つで管理しているので、再実行すれば未処理分だけを冪等に処理して追いつける。
