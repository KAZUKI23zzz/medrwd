/**
 * 静的エクスポート用のsitemap.xmlを生成するスクリプト
 * ビルド後に out/ ディレクトリに出力する
 *
 * 使用方法: npx tsx scripts/generate-sitemap.ts
 */

import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://medrwd-f553wm4wi-kazuki23zzzs-projects.vercel.app";

interface Paper {
  id: string;
  collected_at: string;
  last_updated?: string;
}

interface Database {
  slug: string;
}

function main() {
  const dataDir = path.join(process.cwd(), "data");
  const papers: Paper[] = JSON.parse(fs.readFileSync(path.join(dataDir, "papers.json"), "utf-8"));
  const databases: Database[] = JSON.parse(fs.readFileSync(path.join(dataDir, "databases.json"), "utf-8"));

  const urls: string[] = [];

  // Static pages
  const staticPages = [
    { path: "", priority: "1.0", changefreq: "weekly" },
    { path: "/papers", priority: "0.9", changefreq: "weekly" },
    { path: "/databases", priority: "0.8", changefreq: "monthly" },
    { path: "/news", priority: "0.6", changefreq: "weekly" },
    { path: "/about", priority: "0.5", changefreq: "monthly" },
  ];

  for (const page of staticPages) {
    urls.push(`  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Database pages
  for (const db of databases) {
    urls.push(`  <url>
    <loc>${BASE_URL}/databases/${db.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  // Paper pages
  for (const paper of papers) {
    const lastmod = paper.last_updated || paper.collected_at;
    urls.push(`  <url>
    <loc>${BASE_URL}/papers/${paper.id}</loc>
    <lastmod>${lastmod.split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  // Output to public/ so it's included in static export
  const outPath = path.join(process.cwd(), "public", "sitemap.xml");
  fs.writeFileSync(outPath, sitemap, "utf-8");
  console.log(`Sitemap generated: ${outPath} (${papers.length} papers, ${databases.length} databases)`);
}

main();
