/**
 * 論文詳細へ移動する直前の「一覧のどこを見ていたか」を sessionStorage に控える。
 *
 * 一覧の絞り込み・ページ番号は URL に載っているので url だけで復元でき、
 * スクロール位置だけはここで持ち回る。タブ単位で消えて構わない情報なので
 * localStorage ではなく sessionStorage を使う。
 */

const KEY = "medrwd:papers-return";

export interface PapersReturn {
  /** 一覧のパス＋クエリ（例: `/papers?db=DPC&page=4`） */
  url: string;
  scrollY: number;
}

function isPapersReturn(value: unknown): value is PapersReturn {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.url === "string" && typeof v.scrollY === "number";
}

export function rememberPapersReturn(url: string, scrollY: number): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ url, scrollY }));
  } catch {
    // プライベートモード等で書けなくても機能を落とすだけなので黙って無視する
  }
}

/** 消さずに読む（詳細ページの「戻る」リンクの行き先を決めるのに使う） */
export function peekPapersReturn(): PapersReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPapersReturn(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 控えを消す。
 *
 * 読むのと消すのを1つにまとめると、React StrictMode の二重マウントで
 * 「1回目が消して 1回目の後片付けが復元を中断し、2回目には何も残っていない」
 * という取りこぼしが起きるため、復元し終えた時点で明示的に呼ぶ形にしている。
 */
export function clearPapersReturn(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
