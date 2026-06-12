import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const sentences = sqliteTable("sentences", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const hitokotoSentenceMetadata = sqliteTable(
  "hitokoto_sentence_metadata",
  {
    sentenceId: text("sentence_id")
      .primaryKey()
      .references(() => sentences.id),
    hitokotoUuid: text("hitokoto_uuid"),
    sourceIdentity: text("source_identity").notNull(),
    hitokotoId: integer("hitokoto_id"),
    type: text("type"),
    fromText: text("from_text"),
    fromWho: text("from_who"),
    creator: text("creator"),
    creatorUid: integer("creator_uid"),
    reviewer: integer("reviewer"),
    commitFrom: text("commit_from"),
    hitokotoCreatedAt: text("hitokoto_created_at"),
    length: integer("length"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("hitokoto_sentence_metadata_uuid_idx").on(table.hitokotoUuid),
    uniqueIndex("hitokoto_sentence_metadata_identity_idx").on(
      table.sourceIdentity
    ),
  ]
)

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
    uniqueIndex("cards_sentence_style_idx").on(
      table.sentenceId,
      table.styleVersion
    ),
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

export const generationAttempts = sqliteTable(
  "generation_attempts",
  {
    id: text("id").primaryKey(),
    sentenceId: text("sentence_id")
      .notNull()
      .references(() => sentences.id),
    status: text("status").notNull(),
    promptModel: text("prompt_model").notNull(),
    imageModel: text("image_model").notNull(),
    promptText: text("prompt_text").notNull(),
    promptSource: text("prompt_source").notNull(),
    imageMimeType: text("image_mime_type"),
    imageByteLength: integer("image_byte_length"),
    imageSha256: text("image_sha256"),
    errorStage: text("error_stage"),
    errorMessage: text("error_message"),
    imageGenerationAttempts: integer("image_generation_attempts").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "generation_attempts_status_check",
      sql`${table.status} in ('started', 'prompt_fallback', 'image_generated', 'failed')`
    ),
    check(
      "generation_attempts_prompt_source_check",
      sql`${table.promptSource} in ('rewrite', 'fallback')`
    ),
    check(
      "generation_attempts_error_stage_check",
      sql`${table.errorStage} is null or ${table.errorStage} in ('prompt_rewrite', 'image_generation', 'image_validation', 'smoke_write', 'image_storage', 'image_conversion')`
    ),
    index("generation_attempts_sentence_idx").on(
      table.sentenceId,
      table.createdAt
    ),
    index("generation_attempts_status_idx").on(table.status, table.updatedAt),
  ]
)

export type CardRow = typeof cards.$inferSelect
export type GenerationAttemptRow = typeof generationAttempts.$inferSelect
export type HitokotoSentenceMetadataRow =
  typeof hitokotoSentenceMetadata.$inferSelect
export type ReadyCardViewRow = typeof readyCardViews.$inferSelect
export type SentenceRow = typeof sentences.$inferSelect
