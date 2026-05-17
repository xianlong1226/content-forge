import { db, initDB } from "@/lib/db";
import { reports, topics } from "@/lib/db/schema";
import { desc, eq, count, sql } from "drizzle-orm";

export async function GET() {
  initDB();

  const rows = await db
    .select({
      id: reports.id,
      date: reports.date,
      createdAt: reports.createdAt,
      topicCount: count(topics.id),
    })
    .from(reports)
    .leftJoin(topics, eq(reports.id, topics.reportId))
    .groupBy(reports.id)
    .orderBy(desc(reports.createdAt));

  return Response.json({ items: rows });
}
