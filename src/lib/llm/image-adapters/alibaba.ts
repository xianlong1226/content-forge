import type { ImageGenerateConfig, GeneratedImage } from "../../types";
import type { ImageAdapter } from "./types";

/**
 * 阿里百炼(万相/千问)图片生成适配器
 * 使用 DashScope OpenAPI (Bearer Token) 认证
 *
 * 支持模型：
 * - wan2.7-image-pro / wan2.7-image / wan2.6-image 等 (同步/异步)
 * - qwen-image-2.0-pro / qwen-image-2.0 等 (同步)
 * - z-image-turbo (同步)
 *
 * 同步接口：POST /api/v1/services/aigc/text2image/image-synthesis
 * 异步接口：POST 同上 + Header X-DashScope-Async=enable → 轮询 GET /api/v1/tasks/{task_id}
 */

const DEFAULT_BASE = "https://dashscope.aliyuncs.com";

/** 将标准尺寸 "1024x1024" 转为阿里格式 "1024*1024" */
function convertSize(size: string): string {
  // 阿里百炼也支持 "1K" / "2K" 等简写，但我们默认传精确尺寸
  return size.replace(/x/gi, "*");
}

/**
 * 判断模型是否需要异步调用
 * 部分旧模型只支持异步，新模型支持同步
 */
function isAsyncModel(model: string): boolean {
  // wan2.7 / wan2.6-image / wan2.6-t2i 支持同步
  // qwen-image-2.0 / qwen-image-plus / qwen-image 支持同步
  // z-image-turbo 支持同步
  // 旧模型 (wanx*, wan2.5-t2i-preview 等) 仅异步
  const syncModels = [
    "wan2.7-image-pro", "wan2.7-image", "wan2.6-image", "wan2.6-t2i",
    "qwen-image-2.0-pro", "qwen-image-2.0",
    "z-image-turbo",
  ];
  // 如果模型不在同步列表里，走异步
  return !syncModels.some((m) => model.startsWith(m));
}

export class AlibabaAdapter implements ImageAdapter {
  async generate(prompt: string, config: ImageGenerateConfig): Promise<GeneratedImage> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error("阿里百炼 API Key 未配置");
    }

    const model = config.model || "wan2.7-image-pro";
    const size = convertSize(config.size);
    const needAsync = isAsyncModel(model);

    if (needAsync) {
      return this.generateAsync(baseUrl, apiKey, model, prompt, size, config);
    }

    // 同步调用
    const url = `${baseUrl}/api/v1/services/aigc/text2image/image-synthesis`;
    const body: Record<string, any> = {
      model,
      input: { prompt },
      parameters: {
        size,
        n: 1,
      },
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
      throw new Error(`阿里百炼图片生成失败 (${res.status}): ${errText}`);
    }

    const data = await res.json();

    // 同步响应格式
    const imageUrl = this.extractImageUrl(data);
    if (!imageUrl) {
      throw new Error("阿里百炼返回图片数据为空");
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

  /**
   * 异步调用：提交任务 → 轮询结果
   */
  private async generateAsync(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    size: string,
    config: ImageGenerateConfig
  ): Promise<GeneratedImage> {
    const submitUrl = `${baseUrl}/api/v1/services/aigc/text2image/image-synthesis`;
    const body: Record<string, any> = {
      model,
      input: { prompt },
      parameters: {
        size,
        n: 1,
      },
    };

    // 1. 提交异步任务
    const submitRes = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => "");
      throw new Error(`阿里百炼异步任务提交失败 (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json();
    const taskId = submitData.output?.task_id;
    if (!taskId) {
      throw new Error(`阿里百炼异步任务提交失败：未返回 task_id, ${JSON.stringify(submitData)}`);
    }

    // 2. 轮询结果，最多等 120 秒
    const maxWait = 120_000;
    const interval = 3_000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, interval));

      const queryUrl = `${baseUrl}/api/v1/tasks/${taskId}`;
      const queryRes = await fetch(queryUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!queryRes.ok) {
        throw new Error(`阿里百炼查询任务失败 (${queryRes.status})`);
      }

      const queryData = await queryRes.json();
      const status = queryData.output?.task_status;

      if (status === "SUCCEEDED") {
        const imageUrl = this.extractImageUrl(queryData);
        if (!imageUrl) {
          throw new Error("阿里百炼返回图片数据为空");
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

      if (status === "FAILED") {
        const msg = queryData.output?.message || queryData.message || "未知原因";
        throw new Error(`阿里百炼异步任务失败: ${msg}`);
      }

      // PENDING / RUNNING → 继续轮询
    }

    throw new Error("阿里百炼图片生成超时，请稍后重试");
  }

  /**
   * 从响应中提取图片 URL
   * 兼容同步和异步两种响应格式
   */
  private extractImageUrl(data: any): string | null {
    // 异步格式: output.choices[0].message.content[0].image
    if (data.output?.choices?.[0]?.message?.content) {
      const contents = data.output.choices[0].message.content;
      const imgItem = contents.find((c: any) => c.type === "image" || c.image);
      if (imgItem?.image) return imgItem.image;
    }
    // 同步格式: output.results[0].url 或 data[0].url
    if (data.output?.results?.[0]?.url) return data.output.results[0].url;
    if (data.data?.[0]?.url) return data.data[0].url;

    return null;
  }
}
