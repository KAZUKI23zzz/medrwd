/**
 * 研究カタログの絞り込み状態を URL クエリと相互変換する。
 *
 * 状態を URL に持たせることで
 *  - 絞り込んだ画面をそのまま共有・ブックマークできる
 *  - 詳細ページから戻ったとき / ブラウザの戻るボタンで一覧の続きに復帰できる
 * ようになる。デフォルト値はクエリに出さないので、初期状態の URL は `/papers` のまま。
 */

export type SortOption = "newest" | "oldest" | "if-desc";

export const SORT_OPTIONS: SortOption[] = ["newest", "oldest", "if-desc"];
export const DEFAULT_SORT: SortOption = "newest";

export interface PapersUrlState {
  search: string;
  dbs: string[];
  designs: string[];
  categories: string[];
  methods: string[];
  /** null = 下限なし（データ全体を対象にする） */
  yearFrom: number | null;
  /** null = 上限なし */
  yearTo: number | null;
  sort: SortOption;
  page: number;
}

/** 複数選択できる絞り込み条件のキー */
export type ListFilterKey = "dbs" | "designs" | "categories" | "methods";

/** URLSearchParams と ReadonlyURLSearchParams の両方を受けるための最小インタフェース */
type ParamsLike = {
  get(key: string): string | null;
  getAll(key: string): string[];
};

export const EMPTY_PAPERS_STATE: PapersUrlState = {
  search: "",
  dbs: [],
  designs: [],
  categories: [],
  methods: [],
  yearFrom: null,
  yearTo: null,
  sort: DEFAULT_SORT,
  page: 1,
};

/**
 * 複数選択の値は、カンマで繋がず `?db=A&db=B` のように同じキーを繰り返す。
 *
 * 以前はカンマ区切りにしていたが、値そのものにカンマが入ると区切りと区別が付かない。
 * 自前で %2C に逃がす方法も試したが、今度は値に "%2C" という文字列が入ると
 * 取り違えるうえ、URLSearchParams が % をもう一度符号化するので
 * 日本語の値が二重符号化されて URL が倍近く長くなった。
 * 繰り返しパラメータなら、符号化は URLSearchParams に一度だけ任せられる。
 *
 * カンマ区切りの古いURL（`?db=DPC,JMDC`）も読めるようにしてある。
 */
function parseList(params: ParamsLike, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((raw) => raw.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function parsePapersUrlState(params: ParamsLike): PapersUrlState {
  const sortRaw = params.get("sort");
  const pageRaw = Number.parseInt(params.get("page") ?? "", 10);

  return {
    search: params.get("q") ?? "",
    dbs: parseList(params, "db"),
    designs: parseList(params, "design"),
    categories: parseList(params, "cat"),
    methods: parseList(params, "method"),
    yearFrom: parseYear(params.get("from")),
    yearTo: parseYear(params.get("to")),
    sort: SORT_OPTIONS.includes(sortRaw as SortOption)
      ? (sortRaw as SortOption)
      : DEFAULT_SORT,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** デフォルト値は省略してクエリ文字列を組み立てる（`?` は含まない） */
export function buildPapersQuery(state: PapersUrlState): string {
  const params = new URLSearchParams();

  if (state.search) params.set("q", state.search);
  for (const v of state.dbs) params.append("db", v);
  for (const v of state.designs) params.append("design", v);
  for (const v of state.categories) params.append("cat", v);
  for (const v of state.methods) params.append("method", v);
  if (state.yearFrom !== null) params.set("from", String(state.yearFrom));
  if (state.yearTo !== null) params.set("to", String(state.yearTo));
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));

  return params.toString();
}

/**
 * 掛かっている絞り込みの数（ページ番号・並び順は絞り込みに数えない）。
 * モバイルの「絞り込み (2)」表示に使う。出版年は上限・下限それぞれで1つ数える。
 */
export function countActiveFilters(state: PapersUrlState): number {
  return (
    (state.search !== "" ? 1 : 0) +
    state.dbs.length +
    state.designs.length +
    state.categories.length +
    state.methods.length +
    (state.yearFrom !== null ? 1 : 0) +
    (state.yearTo !== null ? 1 : 0)
  );
}

/**
 * あるDBで絞り込んだ研究カタログの URL。
 *
 * 絞り込み値はカンマ区切りで並べるため、値そのものにカンマが入ると
 * 2つの値に割れてしまう。組み立てを buildPapersQuery に通して1箇所にまとめ、
 * カンマは URL 上でエスケープしておく。
 */
export function papersUrlForDatabase(paperTag: string): string {
  const qs = buildPapersQuery({ ...EMPTY_PAPERS_STATE, dbs: [paperTag] });
  return qs ? `/papers?${qs}` : "/papers";
}

/** 絞り込みが1つでも掛かっているか */
export function hasActiveFilters(state: PapersUrlState): boolean {
  return countActiveFilters(state) > 0;
}
