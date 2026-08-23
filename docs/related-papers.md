# 関連研究の表示（調査完了・実装待ち）

論文詳細ページの「同じDBを使った関連研究」が実質機能していない問題の設計資料。
2026-08 に調査・実測を実施し、方針を確定した。**実装はまだ入っていない。**

## 現状の何が問題か

`app/papers/[id]/page.tsx` の実装は、同じDBを使う論文を集めて先頭5件を取るだけ。

```ts
const related = papers
  .filter((p) => p.id !== paper.id &&
    p.databases_used.some((db) => paper.databases_used.includes(db)))
  .slice(0, 5);
```

`papers.json` は日付降順なので、これは実質「**同じDBを使った最新5件**」になる。

- DPC論文221件すべてで関連研究欄が同一（`pmid-42600244` ほか固定の5件）
- 表示しているのは英語の `title`。`title_ja` は全件あるのに使っていない

## なぜメタデータだけでは解けないか（実測）

| 指標 | 実測 |
|---|---|
| 研究カテゴリの種類 | 9（1論文あたり平均1.31個） |
| 解析手法の種類 | 12（1論文あたり平均0.89個、未付与355/1067件） |
| DB | 10種（未付与267/1067件） |
| MeSH語の付与率 | 540 / 1067 件（51%） |

「DB・研究デザイン・研究カテゴリ」が完全一致する組でグループ化すると、
グループ数255、最大48件（`JADER | 横断的研究 | 安全性・副作用`）、中央値1件。
つまり**48件が同点か、自分だけか**の両極に割れて順位が付かない。

MeSH語も頻出語が Humans(539) / Female(515) / Japan(514) / Male(473) / Aged(435) と
チェックタグで埋まっている。ただし後述のとおり **IDF重み付けと高頻度語カットを入れれば
この問題は自動的に消える**（希少語の 1/5〜1/8 の重みしか持たなくなる）。

→ **関連度の主信号は本文から取る。**

## 使うテキストは英語の title + abstract（日本語ではない）

| フィールド | 文字数 中央値 | 欠損 |
|---|---|---|
| `abstract`（英語） | 1,752 | 11件 |
| `abstract_ja`（AI要約） | 181 | 10件 |

`abstract_ja` は全文訳ではなく2〜3文の要約なので**信号量が約10分の1**。
類似度計算は英語本文で行い、**表示だけ日本語**にする。両方欠損は10件で、
その場合はタイトルのみで計算される（実測でも top1 スコア 0.16〜0.76 を確保）。

## 外部APIは「関連研究リストを埋める」用途には使えない（実測で確認）

### PubMed ELink（pmra / Similar articles）

```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pubmed
  &cmd=neighbor_score&linkname=pubmed_pubmed&retmode=json&id=<PMID>&id=<PMID>...
```

- `&id=A&id=B` と繰り返すと入力IDごとに別 linkset が返る（`id=A,B` だと統合されてしまう）
- 1リクエストで数十件のPMIDをまとめられる。レート制限は 3 rps（APIキーで10 rps）
- 近傍は通常100件、スコア付き、自分自身は除外済み

**しかし本サイトのカタログ内被覆率が致命的に低い。** 無作為20件で実測:

| 指標 | 実測値 |
|---|---|
| PubMed類似トップ5のうち自カタログ内 | 平均 **0.65件** |
| トップ20のうち自カタログ内 | 平均 1.60件 |
| 全100件中で5件以上確保できたシード | **3/20（15%）** |

pmraはPubMed全体（約3,700万件）から近傍を返すので、日本のRWD論文1,067件との
交差がほぼ空になる。**これでは5件のリストを埋められない。**

### OpenAlex `related_works`

公式定義は「concepts の共有数が多い**新しい**論文」であり、テキスト類似でも引用でもない。
実測サンプルで **11件中8件が空配列**。使えない。

### Semantic Scholar

Recommendations API / SPECTER2埋め込みは品質面では最有力だが、2024年8月以降
**フリーメールドメインからのAPIキー申請を受け付けない**方針が公式に明記されており、
gmail.com + 個人サイトでは事実上取得できない。匿名プールは全ユーザー共有かつ削減方針で、
「低メンテナンス」原則に反する。

### 結論

外部APIは**リストを埋める用途では不採用**。ただし「カタログ外への広がり」は
**APIコール不要の外部リンク**で提供できる（後述）。

## 手法の質は頭打ちしている（自前BM25で十分な根拠）

- **RELISH ベンチマーク**（1,500人超の研究者が18万超のPubMed論文ペアを手動評価、
  90%超は原著者本人による判定）: **BM25 / TF-IDF / pmra の3手法は総合性能がほぼ同等**。
  ただし推薦する論文集合が異なるため、ハイブリッドが望ましいとされる。
  <https://academic.oup.com/database/article/doi/10.1093/database/baz085/5608006>
- **Lin & Wilbur 2007（pmra原論文）**: TREC Genomics で BM25 に対する改善は
  「小さいが統計的に有意」なレベルにとどまる。
  <https://bmcbioinformatics.biomedcentral.com/articles/10.1186/1471-2105-8-423>
- **Sjögårde & Ahlgren, JASIST 2024**: 引用ベースとテキストベースの**組み合わせ**が
  単独手法を上回る。<https://asistdl.onlinelibrary.wiley.com/doi/10.1002/asi.24951>

→ 「PubMedと同じ精度でないと」という心配は不要。**BM25＋タグの組み合わせが正しい方向。**

参考実装として arxiv-sanity-lite は TF-IDF(1-2gram, max_features=20000, min_df=5,
**max_df=0.1**, sublinear_tf) + LinearSVC を使っている。`max_df` で高頻度語を切る発想は
本サイトのチェックタグ問題にそのまま効く。
<https://github.com/karpathy/arxiv-sanity-lite/blob/master/compute.py>

## 他サイトの提示スタイル

| サイト | 件数 | 「なぜ関連か」の説明 |
|---|---|---|
| PubMed | 初期5件＋"See all similar articles" | なし |
| Semantic Scholar | 10件前後（TLDR要約付き） | なし |
| Connected Papers | グラフ（バブル＝被引用、色＝年） | あり（グラフ上の距離・経路） |
| Google Scholar | 検索結果形式 | なし |
| ニュース系 | 3〜6件 | タグ表示が一般的 |
| EC | 4〜8件 | 「よく一緒に購入されている」等の明示ラベル |

学術系はほぼ説明を出さない。一方で推薦システムの研究では、説明の付与が
透明性・信頼・目的の項目への到達速度を改善することが一貫して報告されている。

→ **本サイトはDB・手法・領域のタグを自前で持っているので「なぜ関連か」を出せる。
学術系サイトが差別化できていない領域であり、ここが最大の勝ち筋。**

## 実測: ローカルBM25は実際に効く

英語 title(×3) + abstract を語単位でトークン化、簡易ステミング、ストップワード除去、
df<3 と df>25% を捨てて BM25(k1=1.5, b=0.75) 重み付けの L2 正規化ベクトル、
転置索引でコサイン上位を取る。**外部依存ゼロ、純Node。**

| 項目 | 実測 |
|---|---|
| ベクトル構築 | 約 0.3〜0.5 秒（語彙 7,919） |
| 全1,067件の上位10近傍探索 | 約 1.2〜1.4 秒 |
| **合計** | **約 1.9 秒**（`npm run build` はこの環境でコールド27.2秒） |
| 上位5近傍のうち**別DB**の論文 | **64%** |
| 上位5近傍のうち研究カテゴリ一致 | 60% |
| top1 が相互に上位5入りする割合 | 85% |
| DPC先頭20件の上位5近傍 | のべ100件中**ユニーク90件**（現状は全件同一） |

スコア分布と閾値:

| 閾値 | 5件揃う | 3件以上 | 0件 |
|---|---|---|---|
| 0.10 | 1063/1067 | 1066 | 0 |
| **0.15** | **810** | **950** | **16** |
| 0.20 | 355 | 581 | 172 |

top1スコアの中央値は 0.278、top5スコアの中央値は 0.178。

出力例（「認知機能障害が膝関節形成術後のせん妄・退院先に与える影響」）:

```
0.426 脳血管疾患と膝関節置換術後の認知関連合併症：全国コホートからのエビデンス [DPC]
0.378 高血圧は膝関節形成術後の深部静脈血栓症リスクを増加させる [DPC]
0.367 超高齢膝関節形成術患者における肺炎・認知機能障害・脳血管障害リスクの上昇 [DPC]
0.346 単顆置換術と全置換術後の重大な全身合併症リスクの年齢層別比較 [DPC]
0.337 認知機能障害を有する高齢大腿骨近位部骨折患者における術後合併症リスクの増加 [DPC]
```

**失敗モードも実測できている。** JADER論文（光免疫療法の有害事象）では第3位に
無関係な「大腸憩室炎の結腸膀胱瘻」が 0.190 で紛れ込む。**閾値による足切りは必須。**

タグ一致による加点（同DB +12% / 同カテゴリ +10% / 同手法 +6% / 同デザイン +4%）を
掛けると、このノイズは3位のまま残るが相対的に沈み、別DB割合は 64% → 58% になる。
**タイブレークとしては有効だが、単独では効かない。**

## 実装プラン

### Phase 1 — ローカルBM25ハイブリッド（ネットワーク不要・これだけで問題は解ける）

新規 `lib/related-papers.ts` にモジュールスコープでメモ化した計算を置く。
**`data/related.json` のような中間ファイルは作らない。**
Routineが `papers.json` を書き換えても、ビルドのたびに再計算されるので運用が増えない。

```
score = BM25cosine(title×3 + abstract)          // 英語本文
      × (1 + 0.12·同DB + 0.10·同カテゴリ + 0.06·同手法 + 0.04·同デザイン)
足切り: BM25cosine >= 0.15
```

詳細ページを単一リストから**セクション分割**に変える:

1. **「テーマが近い研究」** — 上記スコア上位5件（DBを問わない）
2. **「同じテーマを別のDBで調べた研究」** — 上記から自DBを除いた上位3件
   - 実測: DB付き800件のうち **681件（85%）で1件以上、557件で2件以上**確保できる
   - **DB比較がサイトの主題なので、ここが本サイト独自の価値になる**
3. **「同じDBの新着」** — 現状のロジックを、正直な見出しにして残す

各カードに**「なぜ関連か」チップ**を付ける: `[同じDB: DPC]` `[同じ手法: 傾向スコア]`
`[同じ領域: 安全性・副作用]` `[本文が類似]`。
BM25の寄与語も取り出せる（実測で `knee, cognitive, arthroplasty, impairment` が出た）が、
英語語幹をそのまま日本語UIに出すのは避け、タグベースのチップにする。

あわせて修正: カードの表示を `title` → **`title_ja`**。

**転送量への影響はゼロ。** 詳細ページはサーバコンポーネントなので、関連研究は
ビルド時にHTMLへ焼き込まれる。既知の課題2（`/papers` 一覧が728KB）には一切影響しない。

### Phase 2 — OpenAlex `topics` で疾患・領域軸を手に入れる（データ側の底上げ）

**本サイトに決定的に欠けているのは疾患・領域の軸。** 研究カテゴリ9種は粗すぎる。
OpenAlex の singleton エンドポイントがこれを無料で埋められることを実測で確認した。

```
https://api.openalex.org/works/pmid:<PMID>?select=id,topics,keywords&mailto=<実アドレス>
```

| 項目 | 実測 |
|---|---|
| 取得成功 | **11/11（100%）**。`topics` は常に3件、スコア付き |
| コスト | `x-ratelimit-cost-usd: 0` — **singleton は課金対象外**（残高0でも200が返る） |
| ライセンス | データは **CC0**。再配布・リポジトリ保存すべて自由 |
| 粒度 | 11件から30種のユニークtopic。例:「Cardiac, Anesthesia and Surgical Outcomes」「Cervical Cancer and HPV Research」 |

**注意**: 第1topicのスコアは 0.99 / 0.89 / 0.64 / 0.19 とばらつく。第2・第3topicは
0.00〜0.06 でほぼノイズ。**第1topicのみ、かつスコア閾値付きで採用する。**

- `scripts/sync-pubmed.ts` に取得を追加（新着は週約9件なので負荷は無視できる）
- 既存1,067件は1回だけバックフィル（0.7秒間隔で約13分）
- 得られた topic を Phase 1 のスコアに加点し、**将来はファセット絞り込みにも使える**

### Phase 3 — カタログ外への広がり（APIコール不要）

リスト末尾に外部リンクを置く。ビルド時のネットワークアクセスは発生しない。

```
PubMedで類似論文を見る →
https://pubmed.ncbi.nlm.nih.gov/?linkname=pubmed_pubmed&from_uid=<PMID>
```

PubMedのページ側がpmraを実行するので、カタログ外の関連研究は**PubMedに任せる**。
ELinkの被覆率問題に対する最もコスパの良い回答。

## 関連度を測る以外の打ち手

| 案 | 評価 |
|---|---|
| **「この論文を起点に絞り込む」導線** | ◎ 採用推奨。詳細ページから `/papers?db=DPC&cat=...` へ1クリック。URL状態化(`lib/papers-url-state.ts`)が済んでいるので実装が非常に安い。関連度計算に一切依存しない |
| **セクション分割（混成リスト）** | ◎ Phase 1に含む。ニュース・EC系の定石で、単一リストより文脈に合う |
| **「なぜ関連か」の明示** | ◎ Phase 1に含む。学術系サイトが軒並みやっていない差別化点 |
| **同じ著者の研究** | ✕ **不採用**。著者名が `Tanaka H` 形式で名寄せ不能。`Fushimi K` 122件・`Yasunaga H` 108件は実在の多産著者だが、`Tanaka H` 36件は確実に別人混在。ORCID / OpenAlex著者IDを取らない限り危険 |
| **共引用・書誌結合** | ✕ 不採用。対象が2025〜2026年の論文（502件+565件）なので被引用がほぼゼロ |
| **お気に入りベースの推薦** | △ 将来案。`lib/favorites.ts` はlocalStorageのみでサーバ集計不可。クライアント側で回すには類似度データを配信する必要があり、課題2の転送量と衝突する |
| **MMRによる多様化** | △ 優先度低。同DB・同手法の論文群なのでテキスト的な近重複がもともと少なく、効果が小さいことが実測で確認されている |
| **SPECTER2などの埋め込み** | △ 品質は最有力だが、Python依存か23MBのONNXモデルをビルドに持ち込む。RELISHの結果からBM25との差は限定的と見込まれ、「無料・低メンテナンス」原則に見合わない |

## 検証の勘所

- **同じDBの論文を3件開いて、関連研究欄が実際に別物になるか**を最初に確認する
  （現状はDPC221件すべてで同一。実測ではユニーク90/100件まで改善する）
- 頻出語に引きずられていないか。`Humans` `Japan` `retrospective` で似ていないか
- **低スコア帯のノイズ**を目視する。閾値0.15の妥当性を数十件で確認し、必要なら調整
- ビルド時間。現状 27.2秒（この環境・コールド）に対し、追加は約1.9秒

## 別件・要対応（優先度: 高）

**`scripts/sync-pubmed.ts` のインパクトファクター取得が既に壊れている。**

```ts
const url = `https://api.openalex.org/sources?filter=issn:${issn}&mailto=rwd-catalog@example.com`;
```

OpenAlexは2026年2月に従量課金へ移行し、**list系エンドポイント（`/sources?filter=`）は
課金対象**になった。実測で以下を確認:

```
HTTP 429
{"error":"Rate limit exceeded","message":"Insufficient budget. This request costs
 $0.0001 but you only have $0 remaining. Resets at midnight UTC."}
```

匿名枠は共有IPあたり1,000クレジット（$0.10/日）で、クラウド実行環境のIPでは既に枯渇していた。
`try/catch` で握りつぶしているため、**IFがsilentにnullになる**。

対策:
1. 無料APIキー（$1/日、アカウント作成のみ）を取得して `api_key=` を付与
2. 429を検知してログに出す（現状は無言で失敗する）
3. `mailto` をダミーの `rwd-catalog@example.com` から実在アドレスに変更（polite poolの趣旨）

なお Phase 2 で使う singleton（`/works/pmid:...`）は**コスト0**なので、この問題の影響を受けない。

## 触るファイル

- `app/papers/[id]/page.tsx` の `related` 算出部（39〜46行目付近）と表示部（246行目付近）
  - `BackToPapersLink` は触らない
- 新規: `lib/related-papers.ts`
- Phase 2: `scripts/sync-pubmed.ts`、`types/paper.ts`、`data/papers.json`（topicフィールド追加）
- `data/papers.json` は週次Routineが書き換える。**関連度は事前計算ファイルにせず、
  ビルド時計算にする**（Routine追記時の再生成が不要になる）

## 一次情報

- [Lin & Wilbur 2007 — pmra原論文](https://bmcbioinformatics.biomedcentral.com/articles/10.1186/1471-2105-8-423)
- [RELISH ベンチマーク](https://academic.oup.com/database/article/doi/10.1093/database/baz085/5608006)
- [Sjögårde & Ahlgren, JASIST 2024](https://asistdl.onlinelibrary.wiley.com/doi/10.1002/asi.24951)
- [SPECTER (Cohan et al., ACL 2020)](https://arxiv.org/abs/2004.07180)
- [NCBI E-utilities In-Depth (NBK25499)](https://www.ncbi.nlm.nih.gov/books/NBK25499/)
- [NLM Terms and Conditions](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html)
- [OpenAlex work object — related_works の定義](https://github.com/ourresearch/openalex-docs/blob/main/api-entities/works/work-object/README.md)
- [OpenAlex — 従量課金への移行(2026-02)](https://blog.openalex.org/openalex-api-new-features-and-usage-based-pricing/)
- [Semantic Scholar API Release Notes](https://github.com/allenai/s2-folks/blob/main/API_RELEASE_NOTES.md)
- [arxiv-sanity-lite compute.py](https://github.com/karpathy/arxiv-sanity-lite/blob/master/compute.py)
