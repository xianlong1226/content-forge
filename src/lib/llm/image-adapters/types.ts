import type { ImageGenerateConfig, GeneratedImage } from "../../types";

/**
 * 统一图片生成适配器接口
 * 每个平台实现自己的 generate 方法
 */
export interface ImageAdapter {
  generate(prompt: string, config: ImageGenerateConfig): Promise<GeneratedImage>;
}
