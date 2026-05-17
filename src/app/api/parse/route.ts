import { NextRequest, NextResponse } from "next/server";
import { parseReportWithLLM } from "@/lib/llm/parse-report";
import { db, initDB } from "@/lib/db";
import { reports, topics, settings } from "@/lib/db/schema";
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const markdown = formData.get("markdown") as string | null;

  let rawMarkdown: string;

  if (file) {
    rawMarkdown = await file.text();
  } else if (markdown) {
    rawMarkdown = markdown;
  } else {
    return NextResponse.json({ error: "No input provided" }, { status: 400 });
  }

  // Load LLM config from settings
  const serverConfig = await getSettings();
  const llmConfig = {
    provider: (serverConfig.llm_provider || "deepseek") as "openai" | "anthropic" | "deepseek",
    model: serverConfig.llm_model || "deepseek-chat",
    apiKey: serverConfig.llm_api_key || "",
    baseUrl: serverConfig.llm_base_url || "",
    temperature: 0.3,
  };

  if (!llmConfig.apiKey) {
    return NextResponse.json(
      { error: "API Key 未配置，请先在配置中心填写 LLM API Key" },
      { status: 400 }
    );
  }

  // Parse using LLM
  let parsed;
  try {
    parsed = await parseReportWithLLM(rawMarkdown, llmConfig as any);
  } catch (err: any) {
    return NextResponse.json(
      { error: `内容解析失败: ${err.message}` },
      { status: 500 }
    );
  }

  // Save to DB
  const reportId = crypto.randomUUID();
  await db.insert(reports).values({
    id: reportId,
    date: parsed.date,
    rawMarkdown,
    parsedJson: JSON.stringify(parsed),
  });

  // Save topics
  const topicRows = [...parsed.topics, ...parsed.supplementaryTopics].map(
    (topic, index) => ({
      id: crypto.randomUUID(),
      reportId,
      title: topic.title,
      coreData: JSON.stringify(topic.coreData),
      keyInsights: JSON.stringify(topic.keyInsights),
      suggestedTitles: JSON.stringify(topic.suggestedTitles),
      heatLevel: topic.heatLevel,
      selected: false,
      order: index,
    })
  );

  if (topicRows.length > 0) {
    await db.insert(topics).values(topicRows);
  }

  return NextResponse.json({
    reportId,
    date: parsed.date,
    topics: parsed.topics.map((t, i) => ({
      ...t,
      id: topicRows[i].id,
      heatLevel:
        parsed.topicSummary.find(
          (s) =>
            t.suggestedTitles[0]?.includes(s.title.slice(0, 10)) ||
            s.title.includes(t.title.slice(0, 6))
        )?.heat || t.heatLevel,
    })),
    supplementaryTopics: parsed.supplementaryTopics.map((t, i) => ({
      ...t,
      id: topicRows[parsed.topics.length + i].id,
    })),
  });
}
