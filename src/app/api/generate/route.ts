import { NextRequest } from "next/server";
import { streamGenerate, parseWechatOutput, parseXiaohongshuOutput } from "@/lib/llm/generate";
import { db, initDB } from "@/lib/db";
import { topics, contents, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ParsedTopic, Platform, ContentStyle } from "@/lib/types";
import crypto from "crypto";

async function getSettings(): Promise<Record<string, string>> {
  initDB();
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
  const { topicId, platform, style, llmConfig: clientConfig } = body as {
    topicId: string;
    platform: Platform;
    style: ContentStyle;
    llmConfig?: Record<string, string>;
  };

  // Fetch topic from DB
  const topicRows = await db.select().from(topics).where(eq(topics.id, topicId));
  if (topicRows.length === 0) {
    return new Response(JSON.stringify({ error: "Topic not found" }), { status: 404 });
  }

  const row = topicRows[0];
  const topic: ParsedTopic = {
    title: row.title,
    coreData: JSON.parse(row.coreData),
    keyInsights: JSON.parse(row.keyInsights),
    suggestedTitles: JSON.parse(row.suggestedTitles),
    heatLevel: row.heatLevel,
  };

  // Load LLM config from settings DB, allow client override
  const serverConfig = await getSettings();
  const llmConfig = {
    provider: clientConfig?.provider || serverConfig.llm_provider || "deepseek",
    model: clientConfig?.model || serverConfig.llm_model || "deepseek-chat",
    apiKey: clientConfig?.apiKey || serverConfig.llm_api_key || "",
    baseUrl: clientConfig?.baseUrl || serverConfig.llm_base_url || "",
    temperature: parseFloat(clientConfig?.temperature || serverConfig.llm_temperature || "0.7"),
  };

  if (!llmConfig.apiKey) {
    return new Response(
      JSON.stringify({ error: "API Key 未配置，请先在配置中心填写 LLM API Key" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create content record
  const contentId = crypto.randomUUID();
  await db.insert(contents).values({
    id: contentId,
    topicId,
    platform,
    style,
    status: "draft",
  });

  try {
    const result = await streamGenerate(topic, platform, style, llmConfig as any);

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`)
            );
          }

          // Update content in DB
          await db
            .update(contents)
            .set({
              rawMarkdown: fullText,
              status: "generated",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(contents.id, contentId));

          // Send final parsed result
          const parsed =
            platform === "wechat"
              ? parseWechatOutput(fullText)
              : parseXiaohongshuOutput(fullText);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", contentId, parsed })}\n\n`
            )
          );
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "生成失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
