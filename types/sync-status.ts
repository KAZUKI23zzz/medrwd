export interface SyncStatus {
  /** 最終実行日時（ISO 8601） */
  last_run: string;
  /** 実行結果 */
  status: "success" | "failed";
  /** 今回追加・分類された新着論文数 */
  new_papers: number;
  /** 偽陽性として除外した論文数 */
  filtered_out: number;
  /**
   * Routine が記録した総論文数。
   *
   * **`/status` の表示にはこの値を使わない。** 手順7で論文を取り除くと手順5で
   * 書いたこの数とずれるため、画面は papers.json から数え直している
   * （app/status/page.tsx）。ここに残しているのは実行時の記録として。
   */
  total_papers: number;
  /** 失敗時のエラー理由（成功時は null） */
  error: string | null;
  /** 連続失敗回数（成功で0にリセット） */
  consecutive_failures: number;
}
