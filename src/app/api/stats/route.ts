import { db, initDB } from "@/lib/db";
import { contents, reports } from "@/lib/db/schema";
import { eq, count, gte, sql } from "drizzle-orm";

export async function GET() {
  initDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [dailyReports] = await db
    .select({ count: count() })
    .from(reports)
    .where(gte(reports.createdAt, todayStr));

  const [totalContents] = await db
    .select({ count: count() })
    .from(contents);

  const [pendingReview] = await db
    .select({ count: count() })
    .from(contents)
    .where(sql`${contents.status} IN ('generated', 'reviewed')`);

  const [exported] = await db
    .select({ count: count() })
    .from(contents)
    .where(eq(contents.status, "exported"));

  return Response.json({
    dailyReports: dailyReports.count,
    totalContents: totalContents.count,
    pendingReview: pendingReview.count,
    exported: exported.count,
  });
}
