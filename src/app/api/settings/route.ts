import { NextRequest, NextResponse } from "next/server";
import { db, initDB } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  initDB();
  const rows = await db.select().from(settings);
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  initDB();
  const updates = await req.json();

  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }

  return NextResponse.json({ ok: true });
}
