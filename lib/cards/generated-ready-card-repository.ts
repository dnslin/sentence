import { randomUUID } from "node:crypto"

import { and, eq, sql } from "drizzle-orm"

import { cards } from "@/lib/db/schema"
import {
  removeStoredGeneratedIllustrationByPublicPath,
  resolveGeneratedIllustrationPublicPath,
} from "@/lib/generation/generated-illustration-storage"

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
  const newIllustrationUrl = resolveGeneratedIllustrationPublicPath(
    input.illustrationUrl
  )

  if (!newIllustrationUrl) {
    throw new Error("Generated ready-card illustration URL is invalid")
  }

  const now = new Date()
  const styleVersion = input.styleVersion ?? generatedReadyCardStyleVersion
  const card = {
    id: randomUUID(),
    sentenceId: input.sentenceId,
    status: "ready",
    sceneLabel: input.sceneLabel ?? generatedReadyCardSceneLabel,
    accent: input.accent ?? generatedReadyCardAccent,
    illustrationPath: newIllustrationUrl,
    styleVersion,
    createdAt: now,
    updatedAt: now,
  } as const

  const [existingCard] = await input.client.db
    .select({ id: cards.id, illustrationPath: cards.illustrationPath })
    .from(cards)
    .where(
      and(
        eq(cards.sentenceId, input.sentenceId),
        eq(cards.styleVersion, styleVersion)
      )
    )

  const [persistedCard] = await input.client.db
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
    .returning({ id: cards.id })

  const replacedIllustrationUrl = existingCard?.illustrationPath
    ? resolveGeneratedIllustrationPublicPath(existingCard.illustrationPath)
    : null
  if (
    replacedIllustrationUrl &&
    replacedIllustrationUrl !== newIllustrationUrl
  ) {
    await removeStoredGeneratedIllustrationByPublicPath(replacedIllustrationUrl)
  }

  return {
    id: persistedCard?.id ?? card.id,
    sentence: input.sentenceText,
    sceneLabel: card.sceneLabel,
    accent: card.accent,
    status: "ready",
    illustrationUrl: card.illustrationPath,
  }
}
