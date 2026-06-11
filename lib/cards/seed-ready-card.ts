import { cards, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

const seededAt = new Date("2026-06-11T00:00:00.000Z")
const accents = ["dawn", "rain", "moon"] as const
const sceneLabels = [
  "晨光里的窗边小路",
  "细雨里的屋檐花园",
  "月色里的安静山坡",
] as const

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

const extraSeedReadyCards = Array.from({ length: 60 }, (_, index) => {
  const number = index + 2
  const padded = String(number).padStart(2, "0")
  const accent = accents[index % accents.length]
  const createdAt = new Date(seededAt.getTime() + number * 1000)

  return {
    sentence: {
      id: `seed-hitokoto-refresh-${padded}`,
      text: `第 ${padded} 阵微风，把安静的光留在纸上。`,
      source: "mock",
      createdAt,
    },
    card: {
      id: `seed-quiet-gallery-card-${padded}`,
      sentenceId: `seed-hitokoto-refresh-${padded}`,
      status: "ready",
      sceneLabel: `${sceneLabels[index % sceneLabels.length]} ${padded}`,
      accent,
      illustrationPath: null,
      styleVersion: "quiet-gallery-v1",
      createdAt,
      updatedAt: createdAt,
    },
  } as const
})

export const seedReadyCards = [seedReadyCard, ...extraSeedReadyCards] as const

export async function seedReadyCardStore(client: DatabaseClient) {
  await client.db.transaction(async (tx) => {
    for (const readyCard of seedReadyCards) {
      await tx
        .insert(sentences)
        .values(readyCard.sentence)
        .onConflictDoUpdate({
          target: sentences.id,
          set: {
            text: readyCard.sentence.text,
            source: readyCard.sentence.source,
          },
        })

      await tx
        .insert(cards)
        .values(readyCard.card)
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            sentenceId: readyCard.card.sentenceId,
            status: readyCard.card.status,
            sceneLabel: readyCard.card.sceneLabel,
            accent: readyCard.card.accent,
            illustrationPath: readyCard.card.illustrationPath,
            styleVersion: readyCard.card.styleVersion,
            updatedAt: readyCard.card.updatedAt,
          },
        })
    }
  })
}
