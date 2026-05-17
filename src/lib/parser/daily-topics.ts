import type { ParsedDailyReport, ParsedTopic, TopicSummaryItem } from "../types";

/**
 * Parse a daily-topics markdown report into structured data.
 * Uses rule-based splitting + regex extraction (fast, no LLM needed for this format).
 */
export function parseDailyTopics(markdown: string): ParsedDailyReport {
  const dateMatch = markdown.match(/#\s+.*\|\s*(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch?.[1] ?? new Date().toISOString().slice(0, 10);

  // Split by topic headers (## 🔥 or ## 💊), but NOT ## 📋 (summary tables)
  const topicSections = splitByTopicHeader(markdown).filter(
    (s) => !s.header.includes("📋") && !s.header.includes("速览")
  );

  const topics: ParsedTopic[] = [];
  const supplementaryTopics: ParsedTopic[] = [];

  for (const section of topicSections) {
    const parsed = parseTopicSection(section);
    if (!parsed) continue;

    // Check if supplementary (💊 header)
    const isSupplementary = section.header.includes("💊");
    if (isSupplementary) {
      supplementaryTopics.push(parsed);
    } else {
      topics.push(parsed);
    }
  }

  // Parse summary table at the bottom for heat levels
  const topicSummary = parseSummaryTable(markdown);

  // Enrich heat levels from summary table
  for (const topic of [...topics, ...supplementaryTopics]) {
    const match = topicSummary.find((s) => {
      // Match by checking if the summary title overlaps with the topic title or suggested titles
      return (
        topic.title.includes(s.title.slice(0, 8)) ||
        s.title.includes(topic.title.slice(0, 6)) ||
        topic.suggestedTitles.some((st) => st.includes(s.title.slice(0, 8)))
      );
    });
    if (match) {
      topic.heatLevel = match.heat;
    }
  }

  return { date, topics, supplementaryTopics, topicSummary };
}

interface TopicSection {
  header: string;
  body: string;
}

function splitByTopicHeader(markdown: string): TopicSection[] {
  const sections: TopicSection[] = [];
  // Match ## 🔥 or ## 💊 headers (but NOT 📋 summary tables)
  const regex = /^## [🔥💊].+$/gm;
  let match: RegExpExecArray | null;
  const splits: { index: number; header: string }[] = [];

  while ((match = regex.exec(markdown)) !== null) {
    splits.push({ index: match.index, header: match[0] });
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index + splits[i].header.length;
    const end = i + 1 < splits.length ? splits[i + 1].index : markdown.length;
    sections.push({
      header: splits[i].header,
      body: markdown.slice(start, end),
    });
  }

  return sections;
}

function parseTopicSection(section: TopicSection): ParsedTopic | null {
  const { header, body } = section;

  // Extract title from header:
  // "## 🔥 热门话题一：久坐危机——超4成年轻人脊柱已亮红灯"
  // "## 💊 补充科普：人体工学椅——从"忍痛"到"投资健康""
  // Use flexible regex: take everything after the last colon (：)
  const colonIdx = header.lastIndexOf("：");
  let title: string;
  if (colonIdx > 0) {
    title = header.slice(colonIdx + 1).trim();
  } else {
    // Fallback: take everything after emoji
    const afterEmoji = header.match(/^##\s+\S+\s+(.+)/);
    title = afterEmoji?.[1]?.trim() || "";
  }

  if (!title) return null;

  // Extract core data (under ### 核心数据 or ### 核心信息 or ### 事件概要)
  const coreDataMatch = body.match(
    /###\s+(?:核心数据|核心信息|事件概要|核心数据[^<]*?)\s*\n([\s\S]*?)(?=\n###|\n##|$)/
  );
  const coreData = coreDataMatch
    ? coreDataMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l) => l && !l.startsWith("|") && !l.startsWith("---"))
    : [];

  // Extract science explanation (under ### 科普解读)
  const scienceMatch = body.match(/###\s+科普解读\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  const keyInsights: string[] = [];
  if (scienceMatch) {
    const raw = scienceMatch[1];
    // Split by numbered items like "1. **xxx**：xxx"
    const items = raw.split(/\n(?=\d+\.\s)/);
    for (const item of items) {
      const cleaned = item.trim();
      if (cleaned && !cleaned.startsWith("|") && !cleaned.startsWith("---")) {
        keyInsights.push(cleaned);
      }
    }
  }

  // Extract suggested titles (under ### 📝 文章选题建议)
  const suggestedMatch = body.match(/###\s+📝\s*文章选题建议\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  const suggestedTitles = suggestedMatch
    ? suggestedMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l) => l && !l.startsWith("|") && !l.startsWith("---"))
    : [];

  const heatLevel = 3; // Default, will be overridden by summary table

  return { title, coreData, keyInsights, suggestedTitles, heatLevel };
}

function parseSummaryTable(markdown: string): TopicSummaryItem[] {
  const items: TopicSummaryItem[] = [];
  // Match rows like: | 1 | 久坐8小时死亡率高40%？... | 数据冲击+自救方案 | ⭐⭐⭐⭐⭐ |
  const rowRegex = /\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(⭐+)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const stars = match[4].length;
    items.push({
      index: parseInt(match[1]),
      title: match[2].trim(),
      angle: match[3].trim(),
      heat: stars,
    });
  }
  return items;
}
