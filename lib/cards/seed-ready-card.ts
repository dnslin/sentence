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

export async function seedReadyCardStore(client: DatabaseClient) {
  await client.db.transaction(async (tx) => {
    await tx
      .insert(sentences)
      .values(seedReadyCard.sentence)
      .onConflictDoUpdate({
        target: sentences.id,
        set: {
          text: seedReadyCard.sentence.text,
          source: seedReadyCard.sentence.source,
        },
      })

    await tx
      .insert(cards)
      .values(seedReadyCard.card)
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          sentenceId: seedReadyCard.card.sentenceId,
          status: seedReadyCard.card.status,
          sceneLabel: seedReadyCard.card.sceneLabel,
          accent: seedReadyCard.card.accent,
          illustrationPath: seedReadyCard.card.illustrationPath,
          styleVersion: seedReadyCard.card.styleVersion,
          updatedAt: seedReadyCard.card.updatedAt,
        },
      })
  })
}
