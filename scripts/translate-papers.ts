/**
 * 既存論文の日本語訳を一括生成するスクリプト
 * title_ja / abstract_ja が未設定の論文に対して翻訳を実行する。
 *
 * 使い方:
 *   npx tsx scripts/translate-papers.ts
 */

import * as fs from "fs";
import * as path from "path";

interface Paper {
  id: string;
  title: string;
  title_ja?: string;
  abstract: string;
  abstract_ja?: string;
  [key: string]: unknown;
}

/**
 * Google Translate 無料エンドポイントで英→日翻訳
 * 長文は 5000 文字ごとに分割して翻訳する
 */
const MAX_CHARS = 4500;

async function translateText(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return "";

  // 長文分割
  if (text.length > MAX_CHARS) {
    const chunks = splitText(text, MAX_CHARS);
    const translated: string[] = [];
    for (const chunk of chunks) {
      translated.push(await translateChunk(chunk));
      await sleep(500);
    }
    return translated.join("");
  }

  return translateChunk(text);
}

function splitText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // 文の区切りで分割を試みる
    let splitIdx = remaining.lastIndexOf(". ", maxLen);
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitIdx === -1) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx + 1));
    remaining = remaining.slice(splitIdx + 1);
  }
  return chunks;
}

async function translateChunk(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translation API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as [Array<[string, string]>];

  // レスポンスは [[["翻訳文", "原文"], ...], ...] の形式
  return data[0].map((segment) => segment[0]).join("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const papersPath = path.join(process.cwd(), "data", "papers.json");
  const papers: Paper[] = JSON.parse(fs.readFileSync(papersPath, "utf-8"));

  const needsTranslation = papers.filter(
    (p) => !p.title_ja || (p.abstract && !p.abstract_ja)
  );

  console.log(
    `Total papers: ${papers.length}, needs translation: ${needsTranslation.length}`
  );

  if (needsTranslation.length === 0) {
    console.log("All papers already translated. Exiting.");
    return;
  }

  let translated = 0;
  let errors = 0;
  let consecutiveErrors = 0;
  const SAVE_INTERVAL = 50;

  for (const paper of needsTranslation) {
    try {
      // タイトル翻訳
      if (!paper.title_ja && paper.title) {
        paper.title_ja = await translateText(paper.title);
        await sleep(500);
      }

      // アブストラクト翻訳
      if (!paper.abstract_ja && paper.abstract) {
        paper.abstract_ja = await translateText(paper.abstract);
        await sleep(500);
      }

      translated++;
      consecutiveErrors = 0;
      console.log(
        `[${translated}/${needsTranslation.length}] ${paper.id}: ${paper.title_ja?.slice(0, 50)}...`
      );

      // 中間保存（50件ごと）
      if (translated % SAVE_INTERVAL === 0) {
        fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2), "utf-8");
        console.log(`  → Saved progress (${translated} translated so far)`);
      }
    } catch (e) {
      errors++;
      consecutiveErrors++;
      console.error(`Error translating ${paper.id}:`, e);

      if (consecutiveErrors >= 3) {
        console.error(`\n3 consecutive errors. Saving progress and stopping.`);
        break;
      }
      // エラー後は長めに待つ
      await sleep(5000);
    }
  }

  // 最終保存
  fs.writeFileSync(papersPath, JSON.stringify(papers, null, 2), "utf-8");
  console.log(
    `\nDone! Translated: ${translated}, Errors: ${errors}, Total: ${papers.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
