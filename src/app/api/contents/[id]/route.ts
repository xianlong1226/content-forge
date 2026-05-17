import { db, initDB } from "@/lib/db";
import { contents, topics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initDB();
  const { id } = await params;

  const rows = await db.select().from(contents).where(eq(contents.id, id));
  if (rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const content = rows[0];

  const topicRows = await db
    .select({ title: topics.title })
    .from(topics)
    .where(eq(topics.id, content.topicId));

  return Response.json({
    ...content,
    topicTitle: topicRows[0]?.title || "",
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  initDB();
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (body.rawMarkdown !== undefined) updates.rawMarkdown = body.rawMarkdown;
  if (body.renderedHtml !== undefined) updates.renderedHtml = body.renderedHtml;

  await db.update(contents).set(updates).where(eq(contents.id, id));

  return Response.json({ ok: true });
}
