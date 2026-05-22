import { NextRequest } from "next/server";
import { db, initDB } from "@/lib/db";
import { contents, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateImage, extractImagePrompts } from "@/lib/llm/image-generate";
import type { GeneratedImage, ImageGenerateConfig } from "@/lib/types";

async function getImageSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

export async function POST(req: NextRequest) {
  initDB();

  const body = await req.json();
  const { contentId, prompt, promptIndex, size } = body as {
    contentId: string;
    prompt?: string;
    promptIndex?: number;
    size?: string;
  };

  // Fetch content
  const rows = await db.select().from(contents).where(eq(contents.id, contentId));
  if (rows.length === 0) {
    return Response.json({ error: "内容不存在" }, { status: 404 });
  }

  const content = rows[0];

  // Determine prompt: explicit > from content by index > auto extract first
  let imagePrompt = prompt;
  if (!imagePrompt) {
    const prompts = extractImagePrompts(content.rawMarkdown, content.platform);
    const idx = promptIndex ?? 0;
    imagePrompt = prompts[idx];
  }

  if (!imagePrompt) {
    return Response.json({ error: "未找到图片描述提示词，请手动输入" }, { status: 400 });
  }

  // Load image generation settings
  const serverConfig = await getImageSettings();
  const imageConfig: Partial<ImageGenerateConfig> = {
    provider: serverConfig.image_provider || "siliconflow",
    model: serverConfig.image_model || "",
    apiKey: serverConfig.image_api_key || "",
    apiSecret: serverConfig.image_api_secret || "",
    baseUrl: serverConfig.image_base_url || "",
    size: size || serverConfig.image_size || "1024x1024",
  };

  try {
    const generated: GeneratedImage = await generateImage(imagePrompt, imageConfig);

    // Append to existing images
    const existingImages: GeneratedImage[] = content.images ? JSON.parse(content.images) : [];
    existingImages.push(generated);

    await db
      .update(contents)
      .set({
        images: JSON.stringify(existingImages),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(contents.id, contentId));

    return Response.json({ image: generated, images: existingImages });
  } catch (err: any) {
    return Response.json({ error: err.message || "图片生成失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  initDB();

  const body = await req.json();
  const { contentId, imageIndex } = body as { contentId: string; imageIndex: number };

  const rows = await db.select().from(contents).where(eq(contents.id, contentId));
  if (rows.length === 0) {
    return Response.json({ error: "内容不存在" }, { status: 404 });
  }

  const content = rows[0];
  const images: GeneratedImage[] = content.images ? JSON.parse(content.images) : [];

  if (imageIndex < 0 || imageIndex >= images.length) {
    return Response.json({ error: "图片索引无效" }, { status: 400 });
  }

  images.splice(imageIndex, 1);

  await db
    .update(contents)
    .set({
      images: JSON.stringify(images),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(contents.id, contentId));

  return Response.json({ images });
}
