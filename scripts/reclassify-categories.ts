/**
 * 既存論文に研究カテゴリを付与するスクリプト
 * タイトル・アブストラクト・MeSHタームから研究カテゴリを推定し、papers.json を更新する。
 *
 * 使用方法: npx tsx scripts/reclassify-categories.ts
 */

import * as fs from "fs";
import * as path from "path";

interface KeywordEntry {
  patterns: string[];
  display: string;
}

interface Paper {
  id: string;
  title: string;
  abstract: string;
  mesh_terms: string[];
  research_categories: string[];
  [key: string]: unknown;
}

function countPatternMatches(text: string, patterns: string[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches) count += matches.length;
  }
  return count;
}

function main() {
  const dataDir = path.join(process.cwd(), "data");
  const papersPath = path.join(dataDir, "papers.json");
  const keywordsPath = path.join(dataDir, "db-keywords.json");

  const papers: Paper[] = JSON.parse(fs.readFileSync(papersPath, "utf-8"));
  const keywords = JSON.parse(fs.readFileSync(keywordsPath, "utf-8"));
  const categories: KeywordEntry[] = keywords.research_categories;

  const stats: Record<string, number> = {};
  let otherCount = 0;

  for (const paper of papers) {
    const text = `${paper.title} ${paper.abstract} ${(paper.mesh_terms || []).join(" ")}`;

    const categoryScores: { display: string; score: number }[] = [];
    for (const cat of categories) {
      const score = countPatternMatches(text, cat.patterns);
      if (score > 0) {
        categoryScores.push({ display: cat.display, score });
      }
    }
    categoryScores.sort((a, b) => b.score - a.score);

    paper.research_categories =
      categoryScores.length > 0
        ? categoryScores.slice(0, 2).map((c) => c.display)
        : ["その他"];

    for (const cat of paper.research_categories) {
      stats[cat] = (stats[cat] || 0) + 1;
    }
    if (paper.research_categories[0] === "その他") {
      otherCount++;
    }
  }

  fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2), "utf-8");

  console.log(`Re-classified ${papers.length} papers`);
  console.log(`\nCategory distribution:`);
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\nPapers with no category (その他): ${otherCount}`);
  const detectionRate = Math.round(((papers.length - otherCount) / papers.length) * 100);
  console.log(`Category detection rate: ${detectionRate}%`);
}

main();
