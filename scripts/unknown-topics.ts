/**
 * 辞書に無いトピック・改名されたトピックを `data/unknown-topics.json` に記録する。
 *
 * OpenAlex はトピックを新設・改名する。新設されたトピックが論文に付くと、
 * `data/topic-areas.json` に無いので診療分野が付かない。エラーにはならないため、
 * 放っておくと「最近この分野が増えないな」と人が気づくまで取りこぼしが続く。
 *
 * ここは**検出だけ**を担う。分野を自動で当てはめることはしない
 * （辞書は人が作る、という方針。docs/classification.md と辞書の _readme を参照）。
 * 溜まったものを見て `data/topic-areas.json` に追記するのは人の作業。
 *
 * 収集のたびに papers.json から作り直す。差分更新ではないので、
 * 辞書に追記されたトピックは次の実行で自動的に消える。
 * ただし `first_seen`（いつから未登録のままか）は引き継ぐ。棚卸しの判断に使う。
 */

import fs from "fs";
import path from "path";
import { topicIssuesOf, type TopicLike } from "../lib/clinical-areas";
import type {
  UnknownTopic,
  RenamedTopic,
  UnknownTopicsFile,
} from "../types/unknown-topics";

const FILE = path.join(process.cwd(), "data", "unknown-topics.json");

const README = [
  "OpenAlex が新しく作った（または改名した）トピックのうち、",
  "data/topic-areas.json にまだ無いもの。収集のたびに作り直される。",
  "",
  "unknown: 辞書に無いID。その論文には診療分野が付いていない。",
  "  first_seen から半年ほど経ったものを目安に、辞書へ追記する。",
  "  分野に落ちないと判断したものも、空配列で辞書に入れること",
  "  （そうしないと毎回ここに出続ける）。",
  "",
  "renamed: IDはあるが名前が変わったもの。診療分野はIDで引いているので",
  "  影響はない。辞書側の name を新しい名前に直すだけでよい。",
  "",
  "自動では何も直さない。分野の判断は人がやる。",
];

type PaperLike = {
  pubmed_id?: string;
  openalex_topics?: TopicLike[] | null;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readExisting(): UnknownTopicsFile | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8")) as UnknownTopicsFile;
  } catch {
    // 初回はファイルが無い。壊れていた場合も作り直してよい（履歴は first_seen だけ）
    return null;
  }
}

/**
 * papers.json 全件を辞書に照らし、結果を書き出す。
 * 戻り値は「未登録トピックの種類数」。呼び出し側でログに出す用。
 */
export function updateUnknownTopics(papers: PaperLike[]): {
  unknown: number;
  renamed: number;
} {
  const unknown = new Map<string, UnknownTopic>();
  const renamed = new Map<string, RenamedTopic>();
  const previous = readExisting();
  const firstSeen = new Map(
    (previous?.unknown ?? []).map((u) => [u.id, u.first_seen]),
  );
  const now = today();

  // ID の無いトピックは辞書を引けない＝その論文に診療分野が付かない。
  // 取得は必ず id を含むので通常は0だが、取得失敗で古い値が残った場合に起きうる。
  // 黙って分野なしになると原因が分からないので数えて出す。
  // （papers.json としては scripts/validate-papers.ts が弾く）
  const withoutId = papers.filter((p) =>
    (p.openalex_topics ?? []).some((t) => !/^T\d+$/.test(t?.id ?? "")),
  );
  if (withoutId.length > 0) {
    console.warn(
      `  警告: トピックIDが無い論文が${withoutId.length}件ある（診療分野が付かない）。` +
        ` 例: ${withoutId.slice(0, 3).map((p) => p.pubmed_id).join(", ")}` +
        ` — backfill-openalex.ts --all で取り直すこと`,
    );
  }

  for (const paper of papers) {
    for (const issue of topicIssuesOf(paper.openalex_topics)) {
      if (issue.kind === "unknown") {
        const entry = unknown.get(issue.id) ?? {
          id: issue.id,
          name: issue.name,
          first_seen: firstSeen.get(issue.id) ?? now,
          papers: 0,
          example_pmids: [],
        };
        entry.papers += 1;
        if (entry.example_pmids.length < 5 && paper.pubmed_id)
          entry.example_pmids.push(paper.pubmed_id);
        unknown.set(issue.id, entry);
      } else {
        const entry = renamed.get(issue.id) ?? {
          id: issue.id,
          dictionary_name: issue.knownName,
          openalex_name: issue.name,
          papers: 0,
        };
        entry.papers += 1;
        renamed.set(issue.id, entry);
      }
    }
  }

  const out: UnknownTopicsFile = {
    _readme: README,
    updated_at: now,
    // 古いものから並べる。棚卸しは先頭から見ればよい
    unknown: [...unknown.values()].sort(
      (a, b) => a.first_seen.localeCompare(b.first_seen) || b.papers - a.papers,
    ),
    renamed: [...renamed.values()].sort((a, b) => b.papers - a.papers),
  };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n");
  return { unknown: out.unknown.length, renamed: out.renamed.length };
}
