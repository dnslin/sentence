import { sql } from "drizzle-orm"

import { cards, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

const seededAt = new Date("2026-06-11T00:00:00.000Z")

export const seedReadyCard = {
  sentence: {
    id: "seed-hitokoto-window-letter",
    text: "风停在窗边，像一封没有署名的信。",
    source: "mock",
    createdAt: seededAt,
  },
  card: {
    id: "seed-quiet-gallery-card",
    sentenceId: "seed-hitokoto-window-letter",
    status: "ready",
    sceneLabel: "晨光里的窗边小路",
    accent: "dawn",
    illustrationPath: null,
    styleVersion: "quiet-gallery-v1",
    createdAt: seededAt,
    updatedAt: seededAt,
  },
} as const

export const seedReadyCards = [
  seedReadyCard,
  {
    sentence: {
      id: "seed-hitokoto-rain-note",
      text: "雨声很轻，像小动物路过屋檐。",
      source: "mock",
      createdAt: new Date(seededAt.getTime() + 1000),
    },
    card: {
      id: "seed-quiet-gallery-card-rain-note",
      sentenceId: "seed-hitokoto-rain-note",
      status: "ready",
      sceneLabel: "细雨里的屋檐花园",
      accent: "rain",
      illustrationPath: null,
      styleVersion: "quiet-gallery-v1",
      createdAt: new Date(seededAt.getTime() + 1000),
      updatedAt: new Date(seededAt.getTime() + 1000),
    },
  },
  {
    sentence: {
      id: "seed-hitokoto-moon-hill",
      text: "月亮把山坡照亮，也把沉默照得柔软。",
      source: "mock",
      createdAt: new Date(seededAt.getTime() + 2000),
    },
    card: {
      id: "seed-quiet-gallery-card-moon-hill",
      sentenceId: "seed-hitokoto-moon-hill",
      status: "ready",
      sceneLabel: "月色里的安静山坡",
      accent: "moon",
      illustrationPath: null,
      styleVersion: "quiet-gallery-v1",
      createdAt: new Date(seededAt.getTime() + 2000),
      updatedAt: new Date(seededAt.getTime() + 2000),
    },
  },
] as const

export async function seedReadyCardStore(client: DatabaseClient) {
  await client.db.transaction(async (tx) => {
    await tx
      .insert(sentences)
      .values(seedReadyCards.map((readyCard) => readyCard.sentence))
      .onConflictDoUpdate({
        target: sentences.id,
        set: {
          text: sqlExcluded("text"),
          source: sqlExcluded("source"),
        },
      })

    await tx
      .insert(cards)
      .values(seedReadyCards.map((readyCard) => readyCard.card))
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          sentenceId: sqlExcluded("sentence_id"),
          status: sqlExcluded("status"),
          sceneLabel: sqlExcluded("scene_label"),
          accent: sqlExcluded("accent"),
          illustrationPath: sqlExcluded("illustration_path"),
          styleVersion: sqlExcluded("style_version"),
          updatedAt: sqlExcluded("updated_at"),
        },
      })
  })
}

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`)
}
