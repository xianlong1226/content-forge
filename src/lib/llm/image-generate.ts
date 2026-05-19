import type { ImageGenerateConfig, GeneratedImage } from "../types";

const DEFAULT_IMAGE_CONFIGS: Record<string, Partial<ImageGenerateConfig>> = {
  siliconflow: {
    provider: "siliconflow",
    model: "black-forest-labs/FLUX.1-schnell",
    baseUrl: "https://api.siliconflow.cn/v1",
    size: "1024x1024",
  },
  openai: {
    provider: "openai",
    model: "dall-e-3",
    baseUrl: "https://api.openai.com/v1",
    size: "1024x1024",
  },
};

/**
 * Generate an image from a text prompt using Silicon Flow or OpenAI-compatible API.
 */
export async function generateImage(
  prompt: string,
  config: Partial<ImageGenerateConfig>
): Promise<GeneratedImage> {
  const presetKey = config.provider || "siliconflow";
  const preset = DEFAULT_IMAGE_CONFIGS[presetKey] || DEFAULT_IMAGE_CONFIGS.siliconflow;
  const merged: ImageGenerateConfig = {
    provider: preset.provider!,
    model: config.model || preset.model || "black-forest-labs/FLUX.1-schnell",
    apiKey: config.apiKey || "",
    baseUrl: config.baseUrl || preset.baseUrl || "https://api.siliconflow.cn/v1",
    size: config.size || preset.size || "1024x1024",
  };

  if (!merged.apiKey) {
    throw new Error("图片生成 API Key 未配置，请先在配置中心填写");
  }

  const [width, height] = merged.size.split("x").map(Number);

  // Silicon Flow uses OpenAI-compatible /images/generations endpoint
  const url = `${merged.baseUrl.replace(/\/$/, "")}/images/generations`;

  const body: Record<string, any> = {
    model: merged.model,
    prompt,
    size: merged.size,
    n: 1,
  };

  // Silicon Flow needs response_format for base64
  if (merged.provider === "siliconflow") {
    body.response_format = "b64_json";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${merged.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`图片生成失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const image = data.data?.[0];

  if (!image) {
    throw new Error("图片生成返回数据为空");
  }

  // Prefer b64_json, fallback to url
  let imageUrl: string;
  if (image.b64_json) {
    imageUrl = `data:image/png;base64,${image.b64_json}`;
  } else if (image.url) {
    imageUrl = image.url;
  } else {
    throw new Error("图片生成返回格式异常");
  }

  return {
    prompt,
    url: imageUrl,
    width: width || 1024,
    height: height || 1024,
    model: merged.model,
    createdAt: new Date().toISOString(),
  };
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
