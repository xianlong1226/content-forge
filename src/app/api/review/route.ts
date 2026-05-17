import { NextRequest, NextResponse } from "next/server";
import { checkCompliance } from "@/lib/compliance/checker";
import { reviewWithLLM } from "@/lib/llm/review-content";
import { db, initDB } from "@/lib/db";
import { contents, reviews, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Violation } from "@/lib/types";
import crypto from "crypto";

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

export async function POST(req: NextRequest) {
  initDB();

  const { contentId } = await req.json();
  if (!contentId) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  const rows = await db.select().from(contents).where(eq(contents.id, contentId));
  if (rows.length === 0) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const content = rows[0];
  const text = content.rawMarkdown || "";
  const platform = content.platform as "wechat" | "xiaohongshu";

  // Pass 1: Local fast check (keyword + regex)
  const localResult = checkCompliance(text, platform);
  let allViolations: Violation[] = [...localResult.violations];
  let autoFixed = localResult.autoFixed;

  // Pass 2: LLM deep review
  try {
    const serverConfig = await getSettings();
    const apiKey = serverConfig.llm_api_key || "";

    if (apiKey) {
      const llmConfig = {
        provider: (serverConfig.llm_provider || "deepseek") as "openai" | "anthropic" | "deepseek",
        model: serverConfig.llm_model || "deepseek-chat",
        apiKey,
        baseUrl: serverConfig.llm_base_url || "",
        temperature: 0.1,
      };

      const llmResult = await reviewWithLLM(autoFixed, platform, llmConfig);

      for (const v of llmResult.violations) {
        // Skip duplicate disclaimer check if local already caught it
        if (v.type === "missing_disclaimer" && localResult.hasDisclaimer) continue;

        allViolations.push({
          type: v.type as Violation["type"],
          category: v.category,
          original: v.original,
          suggestion: v.suggestion,
          position: -1,
          severity: v.severity,
        });
      }
    }
  } catch {
    // LLM review failure is non-fatal — local results still count
  }

  // Save review
  const reviewId = crypto.randomUUID();
  const passed = allViolations.every((v) => v.severity !== "error");
  await db.insert(reviews).values({
    id: reviewId,
    contentId,
    violations: JSON.stringify(allViolations),
    autoFixed,
    passed,
    reviewedAt: new Date().toISOString(),
  });

  // Update content status
  if (passed) {
    await db
      .update(contents)
      .set({
        rawMarkdown: autoFixed,
        status: "reviewed",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(contents.id, contentId));
  }

  return NextResponse.json({
    reviewId,
    violations: allViolations,
    autoFixed,
    hasDisclaimer: localResult.hasDisclaimer,
    passed,
  });
}
