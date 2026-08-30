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
| `scripts/sync-pubmed.ts` | PubMed収集（収集専任: 直近90日 + hasabstract → OpenAlexのIF/トピックを付けて classified:false で追記）。分類・翻訳はしない。**1回の取り込みは50件まで**（あふれた分は翌週） |
| `scripts/backfill-openalex.ts` | トピック・IFが欠けている論文を埋め直す（`--all` で全件取り直し。冪等）。**Routineが毎週ビルド前に実行する** |
| `data/papers.json` | 論文メタデータ（全件分類済み）。週次Routineが追記・削除する。`openalex_topics` は関連度つきトピック（OpenAlex由来・CC0） |
| `data/excluded-pmids.json` | 偽陽性として削除した論文のPMID。収集時に `papers.json` と一緒に除外する。**分類に失敗しただけの論文を入れないこと**（二度と収録されなくなる） |
| `data/topic-areas.json` | **トピック→診療分野の辞書**（25分野／OpenAlex全4,516トピック、うち696件に分野）。**キーはトピックID**（`T10183`）。診療分野の軸はここが正 |
| `lib/clinical-areas.ts` | 論文の診療分野を求める（辞書引き＋スコア閾値0.10）。設計判断はここのコメントに集約 |
| `data/unknown-topics.json` | 辞書に無い／改名されたトピックの待ち行列。収集のたびに作り直され、`/status` に出る。**分野の判断は人がやる** |
| `scripts/sync-topic-areas.ts` | 辞書とOpenAlexの公開スナップショットを突き合わせる（新設・改名・消滅を報告。改名だけ `--write-renames` で反映） |
| `data/sync-status.json` | 同期の最終実行状況（Routineが毎回更新、`/status`で表示） |
| `data/databases.json` | RWDデータベース情報（10件。`paper_tag` で論文側の名前と突き合わせる） |
| `docs/routine-classify.md` | **Routineのプロンプト全文＋セットアップ手順** |
| `docs/classification.md` | **分類スキーマ・偽陽性基準（Routineが参照する正）** |
| `docs/DEVELOPMENT.md` | デバッグTips・設計判断・検索式比較・法的リスク・変更履歴 |
| `docs/related-papers.md` | 関連研究の設計判断・ブラインド評価の結果・不採用案の記録 |
| `docs/backlog.md` | **積み残しの課題**（2026-08-30の全体レビュー）。スケールの実測値・「今やらない理由」・**問題ではなかったと確認済みの項目**。同じ場所を疑う前にここを見る |
| `lib/related-papers.ts` | 関連研究の算出（英語本文のBM25コサイン＋診療分野・トピックの加点、ビルド時計算） |
| `components/papers/RelatedPapers.tsx` | 詳細ページの関連研究。診療分野・トピック・DBで絞り込む（**`lib/related-papers` を import しないこと**。papers.json 全体がクライアントに載る） |
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
- 自動化は週次の **Claude Routine 1つ**。GitHub Actions・Google翻訳・PMDAニュースは廃止。
- 手順は8段階。**PRを作らず main へ直接push**する（ブランチ保護なし）。
  ```
  1 npm ci → 2 収集(script) → 3 分類(LLM) → 4 偽陽性除外(LLM) → 5 欠損の補充(script)
  → 6 自己点検(script+build) → 7 status更新(LLM) → 8 main へ直接push
  ```
- **判断はLLM、合否は機械。** 自己点検は `validate-papers.ts` と `npm run build` が判定する。
  検証に落ちたら該当論文だけを最大2回まで直し、直らなければその論文だけ取り除いて残りを通す
  （`excluded-pmids.json` には入れない＝翌週やり直す）。
- `abstract_ja` は全文訳ではなく**2〜3文の日本語AI要約**（WEB上は「AI要約」表示）。
- 失敗の可視化は `/status` ページ（`data/sync-status.json`）＋セーフマージ・ガード。
  **status は自己点検の後に書く**（先に書くと、点検で論文を取り除いたときに数字がずれる）。
  `getSyncStatus`（`lib/data-loader.ts`）が status の値・日時・件数をビルド時に検査し、
  `/status` の総論文数は papers.json から数え直す（手書きの数字を信じない）。
  最終同期の鮮度警告は**閲覧者の時計**で測る（`components/status/StaleWarning.tsx`）。
  ビルド時に測ると、Routineが完全に停止した場合＝ビルドも走らない場合に永久に出ない。
- Routineのセットアップ/運用と**指示文の全文**は `docs/routine-classify.md` 参照。
  要設定2点: ①クラウド環境のネットワーク許可に `eutils.ncbi.nlm.nih.gov`・`api.openalex.org`
  ②Claude GitHub Appをwrite権限で導入。
- **指示文を変えたら claude.ai 側にも貼り直すこと。** リポジトリのファイルは原本にすぎず、
  実際に動くのはRoutineに貼られたテキスト。

**収集の設計（2026-08-29）**
- **検索窓は90日。** `hasabstract` で絞るので、登録時点でアブストラクトが無い論文は
  当たらない。後から付いても登録日は変わらないため、窓が狭いと二度と拾えない
  （実測で14日→90日にすると新規が15件→24件に増えた）。
- **検索結果に件数上限を置かない。** 以前は100件で切っており、PubMedが新しい順に返すため
  古い側を静かに捨てていた。上限に達したら例外で止める。
- **1回の取り込みは50件**（古い順）。LLMの作業量を決めているのはこちらで、検索結果の
  件数ではない（IDは1件19バイト、詳細は7.7KB）。あふれた分は翌週。
- 偽陽性は `excluded-pmids.json` に記録する。しないと窓に入っている間ずっと拾い直す。

**日付の軸は EDAT（2026-08-30）**
- 論文の日付は `entrez_date` / `entrez_year`（**PubMed への収載日**、`YYYY-MM-DD`）。
  UI の表示は「収載年」。**出版日ではない。**
- 2026-08-30 まで `publication_date` という名前で **MEDLINE の索引完了日・最終更新日**が
  入っていた。efetch XML で `<DateCompleted>` が `<PubDate>` より前に置かれており、
  パーサがレコード全体から最初の `<Year>` を拾っていたため（実測: 年が違う57件・
  月が違う387件）。しかも `DateRevised` は再索引のたびに動くので、取り直すと
  1,104件中286件の日付が変わっていた。
- **出版日（`PubDate`）は採らない。** 35%で日が欠け、12%は年だけ。オンライン先行公開だと
  誌面の号（`PubDate`）と電子版公開（`ArticleDate`）が年をまたいで食い違う。
  このサイトに学術的な引用の厳密さは要らないので、欠損が無く不変な軸を採った。
- **EDAT を選んだ理由**: 全件で年月日が揃い（欠損0）、一度付いたら動かず、
  収集の検索窓（`reldate=90`、`datetype` 省略＝`edat`）と同じ軸になる。
- 取得は `scripts/sync-pubmed.ts` の `extractEntrezDate`
  （`<PubMedPubDate PubStatus="entrez">` をスコープして引く）。
  **タグ名だけで `<Year>` を引かないこと。**同じ罠を踏む。

**研究カタログのUX改修 完了（PR #32–#34 / 2026-08）**
絞り込み状態のURL化・AND検索・ファセット件数の動的化・モバイルのドロワー化・
DB一覧の拡充（10件）・お気に入り（localStorage）。
**経緯と設計判断、UIの検証手順は `docs/DEVELOPMENT.md` を参照。**

**診療分野の軸（2026-08）**
OpenAlex のトピック（`topics`、関連度つき最大3件。CC0・singletonは課金対象外）を
`data/topic-areas.json` の辞書で日本の診療科25分野に写像し、絞り込み軸にしている
（約87%に付与、平均1.39分野）。

辞書は **OpenAlex の公開スナップショットから全4,516トピックを収録**している
（`https://openalex.s3.amazonaws.com/data/jsonl/topics/manifest.json`、2026-06-26版）。
**API の list エンドポイント（`?filter=`）は課金対象なので使わないこと。**
手元の論文に出たトピックだけで作ると、新しい論文が持ち込むトピックを取りこぼす
（実際、196件は現時点で未出現だが分野を用意してある）。

**辞書は名前ではなくトピックID（`T10183`）で引く。** OpenAlex は
トピックを改名するので、名前で引くと写像が黙って外れる。IDなら改名しても
分野は無事で、名前の不一致として検出できる。

**新しいトピックは黙って捨てない。** 辞書に無いIDが論文に付いていたら
`data/unknown-topics.json` に溜まり、`/status` に「未登録トピックn種・最古の初出日」
として出る。半年を目安に人が分野を判断して辞書へ追記する
（**自動では分野を付けない**）。分野に落ちないと判断したものも `[]` で
辞書に入れること。そうしないと毎回この待ち行列に出続ける。
スナップショット側の新設・改名は `npx tsx scripts/sync-topic-areas.ts` で確認できる。

**`openalex_subfield` は使わない。** OpenAlex 側のトピック→subfield 写像が誤っており
（`Gastric Cancer Management and Outcomes` の親が `Pulmonary and Respiratory Medicine`）、
subfield「呼吸器」82件の半分が胃癌・前立腺癌・大動脈だった。単一ラベルしか持てない点も
「乳がん患者の眼有害事象＝乳腺＋眼科」を表せず不適。
絞り込み軸・バッジ・検索からは外してある。

関連研究の加点も `openalex_subfield` から置き換え済み（2026-08-29）。
`score = BM25コサイン × (1 + 0.30·診療分野 + 0.20·トピック)`。

第2トピック以降は 0.10 以上のときだけ採る。閾値なしだと `膠原病・リウマチ` が
26→73件に膨らみ、増えた分は無関係な論文だった。**関連研究の重み付けでは閾値を
使わずスコアを係数にしている**（低スコアが自動的に効かなくなる）。
絞り込みの選択肢に出すトピックだけは二値なので 0.10 の閾値を使う。

**MeSHは廃止（2026-08-29）**
収集・表示ともやめた。PubMedの索引付けは公開から遅れるため収集時点では半数にしか付かず、
付いた後に取り直す処理も無いので、集め続けても永久に半分のままだった。診療分野の辞書づくりと
関連研究のスコア検証（参照指標）に使い切ったので役目は終わり。`validate-papers.ts` が
スキーマ外フィールドを弾くので、Routineが書き戻しても検出できる。

**未実装**: Pagefind全文検索 / SJR CSV取込 / DB詳細ページ充実

**積み残しは `docs/backlog.md`（2026-08-30の全体レビュー）。**
スケールは実測で「10倍まで実勢9.6年・100倍は該当文献が存在しない」ため着手しない。
10倍に到達するとしたら最初に壊れるのは `out/` のファイル数（約11,100本でVercelの上限）と
papers.json のgitサイズ（約12,800本でGitHubが警告）で、**BM25ではない。**
「調べたが問題ではなかった」項目も同じ文書に記録してある。

**保留中の判断**: 関連研究のBM25が手法語（機械学習・Markovモデル・中断時系列など）
の一致を拾う問題は、**論文が増えてから再検証する**と決めている（2026-08-29）。
母数不足の裏返しでもあるため、いま手法語を削ると後で不要な細工が残る。
経緯は `docs/related-papers.md`。

## 既知の課題

1. （解消）~~Google Translate無料EP~~ → 翻訳・要約はRoutine(LLM)に移管し廃止。
2. `/papers` の初回表示が重い（brotli後 720KB）。全件の抄録を載せているため
   （抄録だけで生JSONの58%）。検索精度とのトレードオフで現状維持と判断。
   一覧で使わないフィールドは `app/papers/page.tsx` で落としてある（736KB→705KB）。
   その後、検索でサブトピックも引けるよう `topic_names` を全件配信して 720KB
   （+15KB）。測り直すときは `npm run build` 後の `out/papers.txt` を brotli -q 11 で。
3. 診療分野と関連研究は **papers.json に保存せず、ビルドのたびに全件を計算する**
   （診療分野7ms・関連研究724ms。ビルド全体20秒の4%）。保存しないのは、辞書
   （`topic-areas.json`）を唯一の正に保つため。棚卸しで辞書に追記すれば、次のビルドで
   既存論文にも自動的に反映され、papers.json を書き直す処理も再計算の管理も要らない。
   索引はモジュールに1つキャッシュするので、1,100ページ生成しても組み立ては1回きり
   （N×Nにはならない）。値はビルド成果物には焼き込まれるので、ブラウザでの絞り込みは
   計算せず照合するだけ。
4. （解消）~~詳細ページの「関連研究」が実質「同じDBの最新5件」~~ → 本文ベースの
   類似度に置き換え済み。`score = BM25コサイン × (1 + 0.30·診療分野 + 0.20·トピック)`。
   研究カテゴリ・DB・解析手法・研究デザインには**加点しない**（話題の一致に対して
   逆相関だったため。根拠は `lib/related-papers.ts` のコメント）。
   詳細ページで診療分野・トピック・DBによる絞り込みができる
   （`components/papers/RelatedPapers.tsx`。候補15件を渡し、5件ずつ展開）。
   経緯とブラインド評価の結果は `docs/related-papers.md`。
