import type { ImageGenerateConfig, GeneratedImage } from "../../types";
import type { ImageAdapter } from "./types";

/**
 * 字节火山(豆包)图片生成适配器
 * 使用火山方舟 API (Bearer Token) 认证
 * 接口基本兼容 OpenAI /images/generations 格式
 *
 * 支持模型：
 * - doubao-seedream-3.0
 * - doubao-seedrealector 等
 */

const DEFAULT_BASE = "https://ark.cn-beijing.volces.com";

export class BytedanceAdapter implements ImageAdapter {
  async generate(prompt: string, config: ImageGenerateConfig): Promise<GeneratedImage> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error("字节火山 API Key 未配置");
    }

    const model = config.model || "doubao-seedream-3.0";
    const url = `${baseUrl}/api/v3/images/generations`;

    const body: Record<string, any> = {
      model,
      prompt,
      size: config.size,
      n: 1,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`字节火山图片生成失败 (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const image = data.data?.[0];

    if (!image) {
      throw new Error("字节火山返回图片数据为空");
    }

    let imageUrl: string;
    if (image.b64_json) {
      imageUrl = `data:image/png;base64,${image.b64_json}`;
    } else if (image.url) {
      imageUrl = image.url;
    } else {
      throw new Error("字节火山返回格式异常");
    }

    const [width, height] = config.size.split("x").map(Number);
    return {
      prompt,
      url: imageUrl,
      width: width || 1024,
      height: height || 1024,
      model,
      createdAt: new Date().toISOString(),
    };
  }
}
