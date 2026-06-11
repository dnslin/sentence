import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

export const sentences = sqliteTable("sentences", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const cards = sqliteTable(
  "cards",
  {
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
  },
  (table) => [
    check("cards_status_check", sql`${table.status} in ('ready')`),
    check(
      "cards_accent_check",
      sql`${table.accent} in ('dawn', 'rain', 'moon')`
    ),
    index("cards_ready_lookup_idx").on(table.status, table.createdAt, table.id),
  ]
)

export const readyCardViews = sqliteTable(
  "ready_card_views",
  {
    id: text("id").primaryKey(),
    visitorKey: text("visitor_key").notNull(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    seenAt: integer("seen_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("ready_card_views_recent_idx").on(table.visitorKey, table.seenAt),
    index("ready_card_views_card_idx").on(
      table.visitorKey,
      table.cardId,
      table.seenAt
    ),
  ]
)

export type CardRow = typeof cards.$inferSelect
export type ReadyCardViewRow = typeof readyCardViews.$inferSelect
export type SentenceRow = typeof sentences.$inferSelect
