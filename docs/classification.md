# 論文分類ガイド

## 概要

`data/papers.json` の各論文を、Claude Codeのサブエージェント方式で再分類する。
分類済みの論文には `classified: true` フラグが付く。

## 分類スキーマ（確定版 2026-06-01）

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

※ DB名不明の場合は `databases_used: []` とし `additional_data_sources` に説明を記載。NCD（外科手術レジストリ）≠ NDB（レセプト）。

### 偽陽性判定基準

以下は日本のヒトを対象としたRWDデータベース研究ではない。分類はするがサマリーで報告：

- 動物実験
- 日本以外の国で実施された研究
- 計量書誌学（bibliometrics/scientometrics）
- レター、コメンタリー、エディトリアル、正誤表（原著研究を含まない）
- 純粋な画像診断研究（「データベース」が参照データセットであり、レセプト/EHRでない）
- 住民前向きコホート研究（アンケート・健診ベースであり、レセプトDB研究ではない）

---

## 再開手順

### 1. featureブランチを作成（mainから）

### 2. サブエージェント（Agent tool）を起動

以下の抽出スクリプトで未分類20件を取得し、上記スキーマに従って分類、`/tmp/medrwd-batch.json` に書き出し後マージ。

**抽出スクリプト:**
```bash
node -e "
const papers = require('./data/papers.json');
const unclassified = papers.filter(p => !p.classified);
const batch = unclassified.slice(0, 20);
for (const p of batch) {
  console.log(JSON.stringify({
    pubmed_id: p.pubmed_id, title: p.title,
    abstract: p.abstract || '', keywords: p.keywords || [],
    mesh_terms: p.mesh_terms || []
  }));
  console.log('---SEP---');
}
console.error('Remaining after this batch: ' + (unclassified.length - 20));
"
```

**マージスクリプト:**
```bash
node -e "
const fs = require('fs');
const papers = JSON.parse(fs.readFileSync('data/papers.json', 'utf-8'));
const batch = JSON.parse(fs.readFileSync('/tmp/medrwd-batch.json', 'utf-8'));
let merged = 0;
for (const cls of batch) {
  const paper = papers.find(p => p.pubmed_id === cls.pubmed_id);
  if (!paper) { console.warn('Not found:', cls.pubmed_id); continue; }
  Object.assign(paper, cls, { classified: true });
  merged++;
}
fs.writeFileSync('data/papers.json', JSON.stringify(papers, null, 2) + '\n');
const total = papers.filter(p => p.classified).length;
console.log('Batch merged: ' + merged + '/' + batch.length);
console.log('Total classified: ' + total + '/' + papers.length + ' | Remaining: ' + (papers.length - total));
"
```

### 3. 繰り返し（トークン分散のため間隔を空ける）

### 4. 全件完了後
- `data/false-positives.json` の論文を `data/papers.json` から一括削除
- `classified` を `classified` にリネーム
- PRでmainにマージ
