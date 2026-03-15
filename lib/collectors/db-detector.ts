import keywordsData from "@/data/db-keywords.json";

interface DetectionResult {
  databases_used: string[];
  additional_data_sources: string[];
  study_design: string;
  research_categories: string[];
}

interface CompiledEntry {
  regexes: RegExp[];
  display: string;
}

// Pre-compile all regexes at module load time (once per build)
function compileEntries(
  entries: { patterns: string[]; display: string }[]
): CompiledEntry[] {
  return entries.map((entry) => ({
    regexes: entry.patterns.map((p) => new RegExp(p, "i")),
    display: entry.display,
  }));
}

const compiledDatabases = compileEntries(keywordsData.databases);
const compiledAdditionalSources = compileEntries(keywordsData.additional_sources);
const compiledStudyDesigns = compileEntries(keywordsData.study_designs);
const compiledCategories = compileEntries(keywordsData.research_categories);

function matchCompiled(text: string, entries: CompiledEntry[]): string[] {
  const matches: string[] = [];
  for (const entry of entries) {
    for (const re of entry.regexes) {
      if (re.test(text)) {
        matches.push(entry.display);
        break;
      }
    }
  }
  return matches;
}

function countCompiledMatches(text: string, regexes: RegExp[]): number {
  let count = 0;
  for (const re of regexes) {
    // Create a new regex with 'g' flag for counting
    const gre = new RegExp(re.source, "gi");
    const matches = text.match(gre);
    if (matches) count += matches.length;
  }
  return count;
}

export function detectFromText(
  title: string,
  abstract: string,
  meshTerms: string[] = []
): DetectionResult {
  const text = `${title} ${abstract} ${meshTerms.join(" ")}`;

  const databases_used = matchCompiled(text, compiledDatabases);
  const additional_data_sources = matchCompiled(text, compiledAdditionalSources);

  const designs = matchCompiled(text, compiledStudyDesigns);
  const study_design = designs.length > 0 ? designs[0] : "その他";

  // Research categories: score each category by match count, take top 2
  const categoryScores: { display: string; score: number }[] = [];
  for (const cat of compiledCategories) {
    const score = countCompiledMatches(text, cat.regexes);
    if (score > 0) {
      categoryScores.push({ display: cat.display, score });
    }
  }
  categoryScores.sort((a, b) => b.score - a.score);
  const research_categories =
    categoryScores.length > 0
      ? categoryScores.slice(0, 2).map((c) => c.display)
      : ["その他"];

  return { databases_used, additional_data_sources, study_design, research_categories };
}
