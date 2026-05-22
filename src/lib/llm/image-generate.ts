import type { ImageGenerateConfig, GeneratedImage } from "../types";
import { getAdapter, IMAGE_PROVIDER_PRESETS } from "./image-adapters";

/**
 * Generate an image from a text prompt using platform-specific adapter.
 */
export async function generateImage(
  prompt: string,
  config: Partial<ImageGenerateConfig>
): Promise<GeneratedImage> {
  const providerKey = config.provider || "siliconflow";
  const preset = IMAGE_PROVIDER_PRESETS[providerKey] || IMAGE_PROVIDER_PRESETS.siliconflow;

  const merged: ImageGenerateConfig = {
    provider: providerKey,
    model: config.model || preset.model,
    apiKey: config.apiKey || "",
    apiSecret: config.apiSecret || "",
    baseUrl: config.baseUrl || preset.baseUrl,
    size: config.size || preset.size,
  };

  if (!merged.apiKey) {
    throw new Error("图片生成 API Key 未配置，请先在配置中心填写");
  }

  // 腾讯混元需要 SecretKey
  if (merged.provider === "tencent" && !merged.apiSecret) {
    throw new Error("腾讯混元需要同时配置 SecretId 和 SecretKey");
  }

  const adapter = getAdapter(merged.provider);
  return adapter.generate(prompt, merged);
}

/**
 * Extract image prompts from raw markdown content.
 */
export function extractImagePrompts(raw: string | null, platform: string): string[] {
  if (!raw) return [];

  if (platform === "xiaohongshu") {
    const match = raw.match(/---IMAGE_PROMPTS---\s*\n([\s\S]*?)$/);
    if (match) {
      return match[1]
        .split("\n")
        .map((l) => l.replace(/^\d+[.、)）]\s*/, "").replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
    }
  }

  if (platform === "wechat") {
    const match = raw.match(/---COVER_IMAGE_PROMPT---\s*\n([\s\S]*?)$/);
    if (match) {
      const text = match[1].trim();
      return text ? [text] : [];
    }
  }

  return [];
}
