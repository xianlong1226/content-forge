import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "contentforge.db");

const sqlite = new Database(DB_PATH);
// Set busy timeout to avoid SQLITE_BUSY during concurrent access
sqlite.pragma("busy_timeout = 5000");
// Enable WAL mode for better concurrent reads
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Initialize tables if not exist
export function initDB() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      raw_markdown TEXT NOT NULL,
      parsed_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES reports(id),
      title TEXT NOT NULL,
      core_data TEXT NOT NULL,
      key_insights TEXT NOT NULL,
      suggested_titles TEXT NOT NULL,
      heat_level INTEGER NOT NULL DEFAULT 3,
      selected INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id),
      platform TEXT NOT NULL,
      style TEXT NOT NULL DEFAULT 'professional-friendly',
      raw_markdown TEXT,
      rendered_html TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES contents(id),
      violations TEXT NOT NULL DEFAULT '[]',
      auto_fixed TEXT NOT NULL DEFAULT '',
      passed INTEGER NOT NULL DEFAULT 0,
      reviewed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
