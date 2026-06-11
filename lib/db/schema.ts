import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const sentences = sqliteTable("sentences", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  sentenceId: text("sentence_id")
    .notNull()
    .references(() => sentences.id),
  status: text("status").notNull(),
  sceneLabel: text("scene_label").notNull(),
  accent: text("accent").notNull(),
  illustrationPath: text("illustration_path"),
  styleVersion: text("style_version").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export type CardRow = typeof cards.$inferSelect
export type SentenceRow = typeof sentences.$inferSelect
