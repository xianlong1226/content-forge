import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 日报
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  rawMarkdown: text("raw_markdown").notNull(),
  parsedJson: text("parsed_json"), // JSON string of ParsedDailyReport
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// 选题（从素材解析出）
export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => reports.id),
  title: text("title").notNull(),
  coreData: text("core_data").notNull(), // JSON string[]
  keyInsights: text("key_insights").notNull(), // JSON string[]
  suggestedTitles: text("suggested_titles").notNull(), // JSON string[]
  heatLevel: integer("heat_level").notNull().default(3),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  order: integer("order").notNull().default(0),
});

// 内容（生成的文章）
export const contents = sqliteTable("contents", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => topics.id),
  platform: text("platform").notNull(), // "wechat" | "xiaohongshu"
  style: text("style").notNull().default("professional-friendly"),
  rawMarkdown: text("raw_markdown"),
  renderedHtml: text("rendered_html"),
  images: text("images"), // JSON string: GeneratedImage[]
  status: text("status").notNull().default("draft"), // draft | generated | reviewed | exported
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// 合规审查
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  contentId: text("content_id").notNull().references(() => contents.id),
  violations: text("violations").notNull().$defaultFn(() => "[]"), // JSON Violation[]
  autoFixed: text("auto_fixed").notNull().$defaultFn(() => ""),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  reviewedAt: text("reviewed_at"),
});

// 配置
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
