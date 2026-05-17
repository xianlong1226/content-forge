import { NextRequest, NextResponse } from "next/server";
import { formatForWechat, THEMES } from "@/lib/adapters/wechat-formatter";
import { generateCoverPrompt } from "@/lib/adapters/wechat";
import { formatXiaohongshuContent, renderXiaohongshuPost } from "@/lib/adapters/xiaohongshu";
import { parseWechatOutput, parseXiaohongshuOutput } from "@/lib/llm/generate";
import { db, initDB } from "@/lib/db";
import { contents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  initDB();

  const { contentId, theme } = await req.json();
  if (!contentId) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  const rows = await db.select().from(contents).where(eq(contents.id, contentId));
  if (rows.length === 0) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const content = rows[0];
  const rawText = content.rawMarkdown || "";
  const platform = content.platform;

  if (platform === "wechat") {
    const parsed = parseWechatOutput(rawText);
    const bodyMarkdown = parsed.body;

    // Use the WeChat formatter (full inline styles, theme support)
    const selectedTheme = theme || "ink-gold";
    const { html: formattedHtml } = formatForWechat(bodyMarkdown, selectedTheme);
    const coverPrompt = generateCoverPrompt(parsed.title, content.topicId);

    // Title HTML
    const titleHtml = `<h1 style="text-align:center;font-size:22px;font-weight:700;margin:0 0 8px;color:#1a1a1a;line-height:1.6;">${parsed.title}</h1>`;

    // Full article = title + body (for clipboard copy, paste directly into WeChat editor)
    const articleHtml = titleHtml + formattedHtml;

    await db
      .update(contents)
      .set({
        renderedHtml: articleHtml,
        status: "exported",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(contents.id, contentId));

    return NextResponse.json({
      platform: "wechat",
      title: parsed.title,
      bodyMarkdown,
      articleHtml,       // Full formatted article (copy this to clipboard → paste into WeChat)
      theme: selectedTheme,
      availableThemes: Object.keys(THEMES),
      coverImagePrompt: coverPrompt,
    });
  }

  if (platform === "xiaohongshu") {
    const parsed = parseXiaohongshuOutput(rawText);
    const formatted = formatXiaohongshuContent(
      parsed.title,
      parsed.body,
      parsed.tags,
      parsed.imagePrompts
    );
    const rendered = renderXiaohongshuPost(formatted);

    await db
      .update(contents)
      .set({
        renderedHtml: rendered,
        status: "exported",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(contents.id, contentId));

    return NextResponse.json({
      platform: "xiaohongshu",
      title: formatted.title,
      body: formatted.body,
      tags: formatted.tags,
      imagePrompts: formatted.imagePrompts,
      rendered,
    });
  }

  return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
}
