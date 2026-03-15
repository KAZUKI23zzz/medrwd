import keywordsData from "@/data/db-keywords.json";

interface DetectionResult {
  databases_used: string[];
  additional_data_sources: string[];
  study_design: string;
}

function matchPatterns(
  text: string,
  entries: { patterns: string[]; display: string }[]
): string[] {
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

export function detectFromText(
  title: string,
  abstract: string
): DetectionResult {
  const text = `${title} ${abstract}`;

  const databases_used = matchPatterns(text, keywordsData.databases);
  const additional_data_sources = matchPatterns(
    text,
    keywordsData.additional_sources
  );

  const designs = matchPatterns(text, keywordsData.study_designs);
  const study_design = designs.length > 0 ? designs[0] : "その他";

  return { databases_used, additional_data_sources, study_design };
}
