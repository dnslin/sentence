import { sql } from "drizzle-orm"

import { cards, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

const fixtureStartedAt = new Date("2026-06-11T01:00:00.000Z")
const fixtureAccents = ["dawn", "rain", "moon"] as const
const fixtureSceneLabels = [
  "晨光里的窗边小路",
  "细雨里的屋檐花园",
  "月色里的安静山坡",
] as const

export function createExtraReadyCardFixtures(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const padded = String(number).padStart(2, "0")
    const accent = fixtureAccents[index % fixtureAccents.length]
    const createdAt = new Date(fixtureStartedAt.getTime() + number * 1000)

    return {
      sentence: {
        id: `test-hitokoto-refresh-${padded}`,
        text: `第 ${padded} 阵测试微风，把安静的光留在纸上。`,
        source: "test-fixture",
        createdAt,
      },
      card: {
        id: `test-quiet-gallery-card-${padded}`,
        sentenceId: `test-hitokoto-refresh-${padded}`,
        status: "ready",
        sceneLabel: `${fixtureSceneLabels[index % fixtureSceneLabels.length]} ${padded}`,
        accent,
        illustrationPath: null,
        styleVersion: "quiet-gallery-v1",
        createdAt,
        updatedAt: createdAt,
      },
    } as const
  })
}

export async function seedExtraReadyCardFixtures(
  client: DatabaseClient,
  count = 60
) {
  const fixtures = createExtraReadyCardFixtures(count)

  await client.db.transaction(async (tx) => {
    await tx
      .insert(sentences)
      .values(fixtures.map((readyCard) => readyCard.sentence))
      .onConflictDoUpdate({
        target: sentences.id,
        set: {
          text: sql.raw("excluded.text"),
          source: sql.raw("excluded.source"),
        },
      })

    await tx
      .insert(cards)
      .values(fixtures.map((readyCard) => readyCard.card))
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          sentenceId: sql.raw("excluded.sentence_id"),
          status: sql.raw("excluded.status"),
          sceneLabel: sql.raw("excluded.scene_label"),
          accent: sql.raw("excluded.accent"),
          illustrationPath: sql.raw("excluded.illustration_path"),
          styleVersion: sql.raw("excluded.style_version"),
          updatedAt: sql.raw("excluded.updated_at"),
        },
      })
  })
}
