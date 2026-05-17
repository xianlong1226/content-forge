import { db, initDB } from "@/lib/db";
import { contents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  initDB();

  const items = await db
    .select()
    .from(contents)
    .orderBy(desc(contents.updatedAt));

  return Response.json({ items });
}
