import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { ParsedDailyReport, ParsedTopic, TopicSummaryItem } from "../types";

export interface LLMConfig {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
}

export function getModel(config: LLMConfig) {
  if (config.provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: config.apiKey });
    return anthropic(config.model);
  }
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });
  return openai.chat(config.model);
}

const PARSE_PROMPT = `你是一个内容分析助手。请从以下素材内容中提取结构化数据。

要求：
1. 识别素材日期（格式 YYYY-MM-DD）
2. 提取所有主要热门话题作为 topics
3. 提取补充/次要话题作为 supplementaryTopics（如果没有明确的补充话题，可以留空）
4. 对每个话题提取：
   - title: 话题标题（简洁明了）
   - coreData: 核心数据点数组（每个是一条关键数据或事实）
   - keyInsights: 要点分析数组（每个是一条关键洞察或解读）
   - suggestedTitles: 建议的文章标题数组（3-5个有吸引力的标题）
   - heatLevel: 热度 1-5（5为最热）
5. 生成 topicSummary 摘要表，每个话题包含 index, title, angle（切入角度）, heat（热度数字）

请严格返回以下JSON格式，不要包含任何其他内容：
{
  "date": "YYYY-MM-DD",
  "topics": [
    {
      "title": "话题标题",
      "coreData": ["数据点1", "数据点2"],
      "keyInsights": ["洞察1", "洞察2"],
      "suggestedTitles": ["标题1", "标题2", "标题3"],
      "heatLevel": 4
    }
  ],
  "supplementaryTopics": [
    {
      "title": "补充话题标题",
      "coreData": ["数据点"],
      "keyInsights": ["洞察"],
      "suggestedTitles": ["标题1"],
      "heatLevel": 3
    }
  ],
  "topicSummary": [
    { "index": 1, "title": "话题标题", "angle": "切入角度", "heat": 4 }
  ]
}

素材内容：
---`;

export async function parseReportWithLLM(
  markdown: string,
  config: LLMConfig
): Promise<ParsedDailyReport> {
  const model = getModel(config);

  const result = await generateText({
    model,
    prompt: `${PARSE_PROMPT}\n${markdown}`,
    temperature: 0.3,
  });

  const text = result.text;

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  // Try to find JSON object in the response
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM 返回的内容中未找到有效 JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and normalize the structure
  return {
    date: parsed.date || new Date().toISOString().slice(0, 10),
    topics: (parsed.topics || []).map(normalizeTopic),
    supplementaryTopics: (parsed.supplementaryTopics || []).map(normalizeTopic),
    topicSummary: (parsed.topicSummary || []).map(normalizeSummaryItem),
  };
}

function normalizeTopic(t: any): ParsedTopic {
  return {
    title: String(t.title || ""),
    coreData: Array.isArray(t.coreData) ? t.coreData.map(String) : [],
    keyInsights: Array.isArray(t.keyInsights || t.scienceExplanation) ? (t.keyInsights || t.scienceExplanation).map(String) : [],
    suggestedTitles: Array.isArray(t.suggestedTitles) ? t.suggestedTitles.map(String) : [],
    heatLevel: Number(t.heatLevel) || 3,
  };
}

function normalizeSummaryItem(s: any): TopicSummaryItem {
  return {
    index: Number(s.index) || 0,
    title: String(s.title || ""),
    angle: String(s.angle || ""),
    heat: Number(s.heat) || 3,
  };
}
