/**
 * 研究カタログのキーワード検索。
 *
 * 方針は PubMed・医中誌Web・Cochrane・ClinicalTrials.gov に共通する作法に合わせている。
 *  - スペース区切りは AND（4サイトすべてが AND。Google も同じなので説明が要らない）
 *  - 二重引用符はフレーズとして扱う
 *  - 表記ゆれは検索前に吸収する（医中誌の「あいまい検索」に相当）
 *  - 英数字の語は語境界で照合する（日本語は部分一致のまま）
 *
 * OR / NOT / 括弧・フィールド指定は今回は入れていない。知っている人だけが使う機能で、
 * フィールド指定を入れるなら将来「詳細検索」として別に用意する。
 */

import type { ListPaper } from "@/types/paper";

/**
 * 異体字。医中誌の「あいまい検索」が常に同一視している類。
 * 片方に寄せるだけなので、どちらで入力しても同じ結果になる。
 */
const VARIANT_CHARS: Record<string, string> = {
  頚: "頸",
  靱: "靭",
  囊: "嚢",
  膣: "腟",
  剝: "剥",
  曾: "曽",
  瘦: "痩",
  頰: "頬",
  撹: "攪",
};

/**
 * 英国綴り → 米国綴り。
 *
 * 検索語と本文の両方に同じ変換を掛けるので、多少大づかみでも取りこぼしは生まれない
 * （別語どうしが同じ形に寄る可能性はあるが、実害はほぼない）。
 * 実データでは hospitalisation 11件 / paediatric 5件 / tumour 7件 が
 * 米国綴りで検索すると出てこない状態だった。
 */
const SPELLING_VARIANTS: [RegExp, string][] = [
  [/haem/g, "hem"],
  [/oesophag/g, "esophag"],
  [/oedem/g, "edem"],
  [/paediatr/g, "pediatr"],
  [/anaesth/g, "anesth"],
  [/gynaecol/g, "gynecol"],
  [/orthopaed/g, "orthoped"],
  [/leukaem/g, "leukem"],
  [/ischaem/g, "ischem"],
  [/anaem/g, "anem"],
  [/tumour/g, "tumor"],
  [/caesar/g, "cesar"],
  [/diarrhoea/g, "diarrhea"],
  [/foet/g, "fet"],
  [/behaviour/g, "behavior"],
  [/labour/g, "labor"],
  [/centre/g, "center"],
  [/isation/g, "ization"],
  [/ised/g, "ized"],
  [/ising/g, "izing"],
  [/yse/g, "yze"],
];

/**
 * 複数形の s を落とす。英米綴りと同じく検索語・本文の両方に掛ける。
 *
 * 照合を語境界一致にした結果、cancer と cancers が別の語になってしまった
 * （outcome 499件 → 214件、fracture 62件 → 49件、statin 11件 → 5件）。
 *
 * 残りが3文字以上になる語だけを対象にし、ss / us / is で終わる語は外してある。
 * これで status・analysis・access・process はそのまま残り、was・hrs・aes・gas の
 * ような3文字語も削られない。ASCII の語だけが対象なので日本語には影響しない。
 *
 * 後読み（lookbehind）を使えば素直に書けるが、Safari 16.4 未満で動かないため
 * 「除外したい文字を1つ挟む」形にしてある。
 */
const PLURAL_S = /\b([a-z]{2,}?[^siu])s\b/g;

/**
 * 検索用に文字列をならす。検索語・本文の両方に同じものを通すこと。
 *
 * NFKC で全角英数・機種依存文字（Ⅰ→I、㎝→cm、①→1）がまとめて片付く。
 * ハイフン類とスラッシュは空白にするので、`MID-NET` と `MID NET` が同じになる。
 *
 * 「がん」は「癌」に寄せるが、カタカナの「ガン」は寄せていない。
 * ガンマ線・ガンシクロビルまで巻き込んでしまうため（実データでカタカナ表記は4件のみ）。
 */
export function normalizeForSearch(text: string): string {
  let s = text.normalize("NFKC").toLowerCase();
  s = s.replace(/[頚靱囊膣剝曾瘦頰撹]/g, (c) => VARIANT_CHARS[c] ?? c);
  s = s.replace(/がん/g, "癌");
  for (const [pattern, replacement] of SPELLING_VARIANTS) {
    s = s.replace(pattern, replacement);
  }
  s = s.replace(/[-–—/]/g, " ");
  // 引用符は区切り記号として扱い、語には残さない。
  // 本文側にも同じ処理を掛けるので、片方だけ消えて一致しなくなることはない。
  s = s.replace(/[\u0022\u201c\u201d]/g, " ");
  // 複数形は、ハイフンを空白に開いたあとで落とす（`breast-cancers` も対象にするため）
  s = s.replace(PLURAL_S, "$1");
  return s.replace(/\s+/g, " ").trim();
}

/** 1件ぶんの検索対象テキストを1本につなぐ */
function buildHaystack(paper: ListPaper): string {
  return [
    paper.title,
    paper.title_ja ?? "",
    paper.abstract,
    paper.abstract_ja ?? "",
    paper.authors.join(" "),
    paper.journal,
    paper.databases_used.join(" "),
    paper.additional_data_sources?.join(" ") ?? "",
    paper.study_design,
    (paper.research_categories ?? []).join(" "),
    (paper.analysis_methods ?? []).join(" "),
    // 診療分野はカード上にバッジで出ているので、見えている語で検索できるようにする
    paper.clinical_areas.join(" "),
    // OpenAlex のトピック名（英語）。バッジには出ないが、Sepsis のような
    // 語で引いたときに拾えるよう残してある
    paper.openalex_topic ?? "",
    // mesh_terms は入れない。付与率が約半分なうえ、頻出語が
    // Humans / Female / Japan / Male / Aged といったチェックタグ的な語で、
    // 「female」で 500 件超が並ぶような結果になってしまう。
  ].join(" ");
}

/**
 * 全件ぶんの正規化済みテキストを作る。papers と同じ並び。
 *
 * 以前は絞り込みのたびに全件ぶんの文字列を組み立て直しており、
 * 打鍵1回あたり 8.1ms 掛かっていた。1度だけ作って使い回すと 2.3ms になる。
 */
export function buildSearchIndex(papers: ListPaper[]): string[] {
  return papers.map((p) => normalizeForSearch(buildHaystack(p)));
}

/**
 * 入力を検索語に切り分ける。
 * 二重引用符で囲んだ部分はまとめて1語として扱い、それ以外は空白で切る。
 * 閉じ忘れた引用符は、残り全部を1語として扱う。
 */
export function parseSearchQuery(query: string): string[] {
  const terms: string[] = [];
  // 閉じ引用符は任意。入力途中で `"heart failure` のように閉じていない状態でも、
  // 残りをまとめて1語として扱う（閉じ引用符を必須にすると、開き引用符が
  // ただの文字として語に混ざり、どの論文にも一致しなくなる）。
  // カーリークォート（“ ”）も引用符として受け付ける。
  const pattern =
    /[\u0022\u201c]([^\u0022\u201c\u201d]*)[\u0022\u201d]?|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(query)) !== null) {
    const raw = match[1] ?? match[2] ?? "";
    const normalized = normalizeForSearch(raw);
    if (!normalized) continue;
    // 引用符なしの語は、正規化でハイフンが空白になって分かれることがある
    if (match[1] === undefined) {
      terms.push(...normalized.split(" "));
    } else {
      terms.push(normalized);
    }
  }
  return terms;
}

/**
 * 英数字だけの語かどうか。フレーズ（引用符でくくった語）は空白を含むので許している。
 */
const ASCII_TERM = /^[a-z0-9]+(?: [a-z0-9]+)*$/;

/**
 * 正規表現の特殊文字を打ち消す。
 *
 * 現状 ASCII_TERM を通った語には特殊文字が含まれないので、この関数は実質何もしない。
 * それでも挟んでいるのは、`new RegExp` が構文エラーで**例外を投げる**ため。
 * 括弧が閉じていない語がここへ届くと、レンダリング中に throw して画面全体が落ちる。
 * ASCII_TERM を広げるときに気づけなくても、被害が出ないようにしておく。
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, (c) => "\\" + c);
}

/** 語ごとに1度だけ組み立てた照合器 */
export interface CompiledTerm {
  /** 正規化後の語。緩和したことを画面で伝えるのに使う */
  term: string;
  test: (haystack: string) => boolean;
}

/**
 * 検索語を照合器に変換する。全件ぶん回す前に1度だけ呼ぶこと。
 *
 * 英数字の語は語境界で照合する。以前は本文にその文字列が含まれるかだけを見ており、
 * 医学の2〜3文字略語がほぼ全件に一致していた（MI 1,034件・RA 1,065件・OS 1,048件。
 * ICU 260件のうち実際に ICU を含むのは30件で、残りは particular などに当たっていた）。
 * 0件のときしか緩和通知を出さないので、利用者からは「絞り込みが効かなかった」
 * ようにしか見えなかった。
 *
 * 日本語は語境界を取れない（\b は ASCII の語構成文字を前提にしている）ため、
 * 従来どおり部分一致で照合する。「心不全」で「急性心不全」に当てたいので、
 * 日本語についてはそちらの方が望ましい。
 */
export function compileTerms(terms: string[]): CompiledTerm[] {
  return terms.map((term) => {
    if (!ASCII_TERM.test(term)) {
      return { term, test: (haystack: string) => haystack.includes(term) };
    }
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`);
    return { term, test: (haystack: string) => pattern.test(haystack) };
  });
}

/** すべての検索語に一致するか（AND） */
export function matchesAllTerms(
  haystack: string,
  compiled: CompiledTerm[],
): boolean {
  return compiled.every((c) => c.test(haystack));
}
