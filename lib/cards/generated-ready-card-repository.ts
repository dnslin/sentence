import { randomUUID } from "node:crypto"

import { and, eq, sql } from "drizzle-orm"

import { cards } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"
import type { PublicReadyCard, ReadyCardAccent } from "./public-ready-card"

export const generatedReadyCardStyleVersion = "quiet-gallery-v1"
export const generatedReadyCardSceneLabel = "非署名绘本风插画"
export const generatedReadyCardAccent = "dawn" satisfies ReadyCardAccent

export async function upsertGeneratedReadyCard(input: {
  client: DatabaseClient
  sentenceId: string
  sentenceText: string
  illustrationUrl: string
  sceneLabel?: string
  accent?: ReadyCardAccent
  styleVersion?: string
}): Promise<PublicReadyCard> {
  const now = new Date()
  const styleVersion = input.styleVersion ?? generatedReadyCardStyleVersion
  const card = {
    id: randomUUID(),
    sentenceId: input.sentenceId,
    status: "ready",
    sceneLabel: input.sceneLabel ?? generatedReadyCardSceneLabel,
    accent: input.accent ?? generatedReadyCardAccent,
    illustrationPath: input.illustrationUrl,
    styleVersion,
    createdAt: now,
    updatedAt: now,
  } as const

  await input.client.db
    .insert(cards)
    .values(card)
    .onConflictDoUpdate({
      target: [cards.sentenceId, cards.styleVersion],
      set: {
        status: sql.raw("excluded.status"),
        sceneLabel: sql.raw("excluded.scene_label"),
        accent: sql.raw("excluded.accent"),
        illustrationPath: sql.raw("excluded.illustration_path"),
        updatedAt: sql.raw("excluded.updated_at"),
      },
    })

  const [persistedCard] = await input.client.db
    .select({ id: cards.id })
    .from(cards)
    .where(
      and(
        eq(cards.sentenceId, input.sentenceId),
        eq(cards.styleVersion, styleVersion)
      )
    )

  return {
    id: persistedCard?.id ?? card.id,
    sentence: input.sentenceText,
    sceneLabel: card.sceneLabel,
    accent: card.accent,
    status: "ready",
    illustrationUrl: card.illustrationPath,
  }
}
