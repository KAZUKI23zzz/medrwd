/**
 * 既存論文に解析手法を一括検出するスクリプト
 * タイトル・アブストラクト・MeSHタームから解析手法を推定し、papers.json を更新する。
 * また、旧フィールド disease_area を analysis_methods にリネームする。
 *
 * 使用方法: npx tsx scripts/detect-analysis-methods.ts
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
  analysis_methods?: string[];
  disease_area?: string[];
  [key: string]: unknown;
}

function matchPatterns(text: string, entries: KeywordEntry[]): string[] {
  const matches: string[] = [];
  for (const entry of entries) {
    for (const pattern of entry.patterns) {
      if (new RegExp(pattern, "i").test(text)) {
        matches.push(entry.display);
        break;
      }
    }
  }
  return matches;
}

function main() {
  const dataDir = path.join(process.cwd(), "data");
  const papersPath = path.join(dataDir, "papers.json");
  const keywordsPath = path.join(dataDir, "db-keywords.json");

  const papers: Paper[] = JSON.parse(fs.readFileSync(papersPath, "utf-8"));
  const keywords = JSON.parse(fs.readFileSync(keywordsPath, "utf-8"));
  const methods: KeywordEntry[] = keywords.analysis_methods;

  const stats: Record<string, number> = {};
  let detectedCount = 0;

  for (const paper of papers) {
    // Remove old disease_area field
    if ("disease_area" in paper) {
      delete paper.disease_area;
    }

    const text = `${paper.title} ${paper.abstract} ${(paper.mesh_terms || []).join(" ")}`;
    const detected = matchPatterns(text, methods);
    paper.analysis_methods = detected;

    if (detected.length > 0) {
      detectedCount++;
      for (const method of detected) {
        stats[method] = (stats[method] || 0) + 1;
      }
    }
  }

  fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2), "utf-8");

  console.log(`Processed ${papers.length} papers`);
  console.log(`Papers with analysis methods detected: ${detectedCount} (${Math.round((detectedCount / papers.length) * 100)}%)`);
  console.log(`\nAnalysis method distribution:`);
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [method, count] of sorted) {
    console.log(`  ${method}: ${count}`);
  }
}

main();
