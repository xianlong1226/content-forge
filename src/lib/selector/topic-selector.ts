import type { ParsedTopic } from "../types";

export interface SelectionConfig {
  maxTopics: number;
  preferHighHeat: boolean;
  avoidSensitive: boolean;
  sensitiveKeywords: string[];
}

const DEFAULT_CONFIG: SelectionConfig = {
  maxTopics: 2,
  preferHighHeat: true,
  avoidSensitive: true,
  sensitiveKeywords: [
    "政治",
    "疫情",
    "自杀",
  ],
};

/**
 * Select the best topics from a parsed daily report.
 * Returns ordered list of selected topics.
 */
export function selectTopics(
  topics: ParsedTopic[],
  config: Partial<SelectionConfig> = {}
): ParsedTopic[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let candidates = [...topics];

  // Filter sensitive topics
  if (cfg.avoidSensitive) {
    candidates = candidates.filter((topic) => {
      const text = [topic.title, ...topic.coreData, ...topic.keyInsights].join(" ");
      return !cfg.sensitiveKeywords.some((kw) => text.includes(kw));
    });
  }

  // Sort by heat level (descending)
  if (cfg.preferHighHeat) {
    candidates.sort((a, b) => b.heatLevel - a.heatLevel);
  }

  // Deduplicate similar topics (simple title similarity)
  const selected: ParsedTopic[] = [];
  for (const topic of candidates) {
    if (selected.length >= cfg.maxTopics) break;
    const isDuplicate = selected.some((s) =>
      titleSimilarity(s.title, topic.title) > 0.4
    );
    if (!isDuplicate) {
      selected.push(topic);
    }
  }

  return selected;
}

/**
 * Simple title similarity based on shared characters.
 */
function titleSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  const intersection = new Set([...setA].filter((c) => setB.has(c)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
