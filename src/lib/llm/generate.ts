import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { buildPrompt } from "./prompt-builder";
import type { ParsedTopic, Platform, ContentStyle } from "../types";

export interface LLMConfig {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
}

const DEFAULT_CONFIGS: Record<string, LLMConfig> = {
  deepseek: {
    provider: "openai", // DeepSeek uses OpenAI-compatible API
    model: "deepseek-chat",
    apiKey: "",
    baseUrl: "https://api.deepseek.com/v1",
    temperature: 0.7,
  },
  openai: {
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
    temperature: 0.7,
  },
  anthropic: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: "",
    temperature: 0.7,
  },
};

/**
 * Get the AI model instance based on config.
 */
function getModel(config: LLMConfig) {
  if (config.provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: config.apiKey });
    return anthropic(config.model);
  }

  // OpenAI-compatible (includes DeepSeek)
  // Use .chat() to hit /chat/completions instead of /responses
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });
  return openai.chat(config.model);
}

/**
 * Stream generate content for a topic on a specific platform.
 * Returns a ReadableStream for real-time output.
 */
export async function streamGenerate(
  topic: ParsedTopic,
  platform: Platform,
  style: ContentStyle,
  config: Partial<LLMConfig> = {}
) {
  const presetKey = config.provider === "openai" ? "openai" : config.provider || "deepseek";
  const merged: LLMConfig = { ...DEFAULT_CONFIGS[presetKey], ...config };

  if (!merged.apiKey) {
    throw new Error(`API Key not configured for provider: ${merged.provider}`);
  }

  const model = getModel(merged);
  const prompt = buildPrompt({ topic, platform, style });

  const result = streamText({
    model,
    prompt,
    temperature: merged.temperature,
  });

  return result;
}

/**
 * Parse the raw LLM output into structured content.
 */
export function parseWechatOutput(raw: string) {
  const titleMatch = raw.match(/---TITLE---\s*\n(.+?)(?:\n|$)/);
  const bodyMatch = raw.match(/---BODY---\s*\n([\s\S]*?)(?=\n---COVER_IMAGE_PROMPT---|$)/);

  return {
    title: titleMatch?.[1]?.trim() || "未提取到标题",
    body: bodyMatch?.[1]?.trim() || raw,
  };
}

export function parseXiaohongshuOutput(raw: string) {
  const titleMatch = raw.match(/---TITLE---\s*\n(.+?)(?:\n|$)/);
  const bodyMatch = raw.match(/---BODY---\s*\n([\s\S]*?)(?=\n---TAGS---|$)/);
  const tagsMatch = raw.match(/---TAGS---\s*\n(.+?)(?:\n---|$)/);
  const imagePromptsMatch = raw.match(/---IMAGE_PROMPTS---\s*\n([\s\S]*?)$/);

  const tags = tagsMatch?.[1]?.trim().split(/\s+/).filter(Boolean) || [];
  const imagePrompts = imagePromptsMatch?.[1]
    ?.split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean) || [];

  return {
    title: titleMatch?.[1]?.trim() || "未提取到标题",
    body: bodyMatch?.[1]?.trim() || "",
    tags,
    imagePrompts,
  };
}
