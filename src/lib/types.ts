export interface ParsedTopic {
  title: string;
  coreData: string[];
  keyInsights: string[];
  suggestedTitles: string[];
  heatLevel: number;
}

export interface TopicSummaryItem {
  index: number;
  title: string;
  angle: string;
  heat: number;
}

export interface ParsedDailyReport {
  date: string;
  topics: ParsedTopic[];
  supplementaryTopics: ParsedTopic[];
  topicSummary: TopicSummaryItem[];
}

export type Platform = "wechat" | "xiaohongshu";
export type ContentStyle = "professional-friendly" | "casual" | "dry-humor";
export type ContentStatus = "draft" | "generated" | "reviewed" | "exported";

export interface Violation {
  type: "banned_word" | "missing_disclaimer" | "sensitive_claim" | "industry_compliance" | "ad_law" | "platform_rule" | "factual" | "other";
  category?: string;
  original: string;
  replacement?: string;
  suggestion?: string;
  position: number;
  severity: "warning" | "error";
}

export interface WechatOutput {
  html: string;
  title: string;
  coverImagePrompt: string;
  summary: string;
}

export interface XiaohongshuOutput {
  title: string;
  body: string;
  imagePrompts: string[];
  tags: string[];
}

// 图片生成相关类型
export interface GeneratedImage {
  prompt: string;
  url: string;       // 图片 URL 或 base64 data URI
  width: number;
  height: number;
  model: string;
  createdAt: string;
}

export type ImageProvider = "siliconflow" | "openai" | "tencent" | "alibaba" | "bytedance";

export interface ImageGenerateConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiSecret?: string;  // 腾讯混元用：SecretKey；其他平台可忽略
  baseUrl: string;
  size: string;      // e.g. "1024x1024"
}
