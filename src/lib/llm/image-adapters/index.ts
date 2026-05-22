import type { ImageGenerateConfig, GeneratedImage } from "../../types";
import type { ImageAdapter } from "./types";
import { OpenAICompatAdapter } from "./openai-compat";
import { TencentAdapter } from "./tencent";
import { AlibabaAdapter } from "./alibaba";
import { BytedanceAdapter } from "./bytedance";

/**
 * 适配器注册表
 * provider → 适配器实例
 */
const adapters: Record<string, ImageAdapter> = {
  siliconflow: new OpenAICompatAdapter(),
  openai: new OpenAICompatAdapter(),
  tencent: new TencentAdapter(),
  alibaba: new AlibabaAdapter(),
  bytedance: new BytedanceAdapter(),
};

/**
 * 根据 provider 获取对应的图片生成适配器
 */
export function getAdapter(provider: string): ImageAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    // 未知 provider 降级到 OpenAI 兼容模式
    return adapters.siliconflow;
  }
  return adapter;
}

/**
 * 各平台预设配置
 */
export const IMAGE_PROVIDER_PRESETS: Record<
  string,
  { model: string; baseUrl: string; size: string; label: string; needsSecret?: boolean }
> = {
  siliconflow: {
    label: "Silicon Flow",
    model: "black-forest-labs/FLUX.1-schnell",
    baseUrl: "https://api.siliconflow.cn/v1",
    size: "1024x1024",
  },
  openai: {
    label: "OpenAI (DALL-E)",
    model: "dall-e-3",
    baseUrl: "https://api.openai.com/v1",
    size: "1024x1024",
  },
  tencent: {
    label: "腾讯混元",
    model: "lite",
    baseUrl: "https://aiart.tencentcloudapi.com",
    size: "1024x1024",
    needsSecret: true,
  },
  alibaba: {
    label: "阿里百炼 (万相/千问)",
    model: "wan2.7-image-pro",
    baseUrl: "https://dashscope.aliyuncs.com",
    size: "1024x1024",
  },
  bytedance: {
    label: "字节火山 (豆包)",
    model: "doubao-seedream-3.0",
    baseUrl: "https://ark.cn-beijing.volces.com",
    size: "1024x1024",
  },
};

export { OpenAICompatAdapter, TencentAdapter, AlibabaAdapter, BytedanceAdapter };
