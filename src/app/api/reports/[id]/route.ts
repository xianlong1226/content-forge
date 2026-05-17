import { db, initDB } from "@/lib/db";
import { reports, topics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initDB();
  const { id } = await params;

  const reportRows = await db.select().from(reports).where(eq(reports.id, id));
  if (reportRows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const report = reportRows[0];
  const topicRows = await db.select().from(topics).where(eq(topics.reportId, id));

  // Separate main topics from supplementary based on order
  const parsed = report.parsedJson ? JSON.parse(report.parsedJson) : null;
  const mainCount = parsed?.topics?.length || 0;

  const allTopics = topicRows.map((t) => ({
    id: t.id,
    title: t.title,
    coreData: JSON.parse(t.coreData),
    keyInsights: JSON.parse(t.keyInsights),
    suggestedTitles: JSON.parse(t.suggestedTitles),
    heatLevel: t.heatLevel,
  }));

  return Response.json({
    reportId: report.id,
    date: report.date,
    topics: allTopics.slice(0, mainCount),
    supplementaryTopics: allTopics.slice(mainCount),
  });
}
