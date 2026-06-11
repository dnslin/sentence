import { randomUUID } from "node:crypto"

import { and, asc, desc, eq, inArray } from "drizzle-orm"

import {
  isReadyCardAccent,
  readyCardAccents,
  type PublicReadyCard,
} from "./public-ready-card"
import type { ReadyCardRequestContext } from "./ready-card-request-context"

import { cards, readyCardViews, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

const recentWindowSize = 50

type ReadyCardRow = {
  id: string
  sentence: string
  sceneLabel: string
  accent: string
  status: string
}

type ValidReadyCardRow = ReadyCardRow & {
  accent: PublicReadyCard["accent"]
  status: PublicReadyCard["status"]
}

type ViewRow = {
  cardId: string
  seenAt: Date
}

function isValidReadyCardRow(row: ReadyCardRow): row is ValidReadyCardRow {
  return row.status === "ready" && isReadyCardAccent(row.accent)
}

function toPublicReadyCard(row: ValidReadyCardRow): PublicReadyCard {
  return {
    id: row.id,
    sentence: row.sentence,
    sceneLabel: row.sceneLabel,
    accent: row.accent,
    status: row.status,
  }
}

function selectLeastRecentlySeenCard(
  cardsToSelect: ValidReadyCardRow[],
  recentViews: ViewRow[]
) {
  const latestSeenAtByCard = new Map<string, number>()

  for (const view of recentViews) {
    if (latestSeenAtByCard.has(view.cardId)) continue
    latestSeenAtByCard.set(view.cardId, view.seenAt.getTime())
  }

  return [...cardsToSelect].sort((left, right) => {
    const leftSeenAt =
      latestSeenAtByCard.get(left.id) ?? Number.NEGATIVE_INFINITY
    const rightSeenAt =
      latestSeenAtByCard.get(right.id) ?? Number.NEGATIVE_INFINITY

    if (leftSeenAt !== rightSeenAt) return leftSeenAt - rightSeenAt
    return left.id.localeCompare(right.id)
  })[0]
}

export async function getNextReadyCardForVisitor(
  client: DatabaseClient,
  context: ReadyCardRequestContext
): Promise<PublicReadyCard | null> {
  const rows = await client.db
    .select({
      id: cards.id,
      sentence: sentences.text,
      sceneLabel: cards.sceneLabel,
      accent: cards.accent,
      status: cards.status,
    })
    .from(cards)
    .innerJoin(sentences, eq(cards.sentenceId, sentences.id))
    .where(
      and(eq(cards.status, "ready"), inArray(cards.accent, readyCardAccents))
    )
    .orderBy(asc(cards.createdAt), asc(cards.id))

  const readyCards = rows.filter(isValidReadyCardRow)
  if (readyCards.length === 0) return null

  const recentViews = await client.db
    .select({ cardId: readyCardViews.cardId, seenAt: readyCardViews.seenAt })
    .from(readyCardViews)
    .where(eq(readyCardViews.visitorKey, context.visitorKey))
    .orderBy(desc(readyCardViews.seenAt), desc(readyCardViews.id))

  const recentWindowCardIds = new Set(
    recentViews.slice(0, recentWindowSize).map((view) => view.cardId)
  )
  const outsideRecentWindow = readyCards.filter(
    (card) => !recentWindowCardIds.has(card.id)
  )
  const eligibleCards =
    outsideRecentWindow.length > 0 ? outsideRecentWindow : readyCards
  const selected = selectLeastRecentlySeenCard(eligibleCards, recentViews)

  if (!selected) return null

  const latestSeenAt = recentViews[0]?.seenAt.getTime() ?? 0
  const nextSeenAt = new Date(Math.max(Date.now(), latestSeenAt + 1))

  await client.db.insert(readyCardViews).values({
    id: randomUUID(),
    visitorKey: context.visitorKey,
    cardId: selected.id,
    seenAt: nextSeenAt,
  })

  return toPublicReadyCard(selected)
}
