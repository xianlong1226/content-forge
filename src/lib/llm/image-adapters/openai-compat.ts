import type { ImageGenerateConfig, GeneratedImage } from "../../types";
import type { ImageAdapter } from "./types";

/**
 * OpenAI 兼容适配器
 * 适用于：SiliconFlow / OpenAI DALL-E / 任何兼容 /images/generations 的平台
 */
export class OpenAICompatAdapter implements ImageAdapter {
  async generate(prompt: string, config: ImageGenerateConfig): Promise<GeneratedImage> {
    const [width, height] = config.size.split("x").map(Number);

    const url = `${config.baseUrl.replace(/\/$/, "")}/images/generations`;

    const body: Record<string, any> = {
      model: config.model,
      prompt,
      size: config.size,
      n: 1,
    };

    // SiliconFlow 需要 b64_json 格式
    if (config.provider === "siliconflow") {
      body.response_format = "b64_json";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
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
      model: config.model,
      createdAt: new Date().toISOString(),
    };
  }
}
