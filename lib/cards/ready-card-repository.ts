import { randomUUID } from "node:crypto"

import { and, asc, desc, eq, gt, inArray, notInArray } from "drizzle-orm"

import {
  isReadyCardAccent,
  readyCardAccents,
  type PublicReadyCard,
} from "./public-ready-card"
import type { ReadyCardRequestContext } from "./ready-card-request-context"

import { cards, readyCardViews, sentences } from "@/lib/db/schema"

import { runImmediateTransaction, type DatabaseClient } from "@/lib/db/client"

const recentWindowSize = 50
const readyPoolLimit = 200
const retainedViewsPerVisitor = recentWindowSize * 3

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
  id: string
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
  latestViews: ViewRow[]
) {
  const latestSeenAtByCard = new Map<string, number>()

  for (const view of latestViews) {
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

async function loadReadyCards(client: DatabaseClient) {
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
    .where(and(eq(cards.status, "ready"), inArray(cards.accent, readyCardAccents)))
    .orderBy(asc(cards.createdAt), asc(cards.id))
    .limit(readyPoolLimit)

  return rows.filter(isValidReadyCardRow)
}

async function loadRecentViews(client: DatabaseClient, visitorKey: string) {
  return client.db
    .select({
      id: readyCardViews.id,
      cardId: readyCardViews.cardId,
      seenAt: readyCardViews.seenAt,
    })
    .from(readyCardViews)
    .where(eq(readyCardViews.visitorKey, visitorKey))
    .orderBy(desc(readyCardViews.seenAt), desc(readyCardViews.id))
    .limit(retainedViewsPerVisitor)
}

async function pruneVisitorViews(client: DatabaseClient, visitorKey: string) {
  const retainedRows = await client.db
    .select({ id: readyCardViews.id })
    .from(readyCardViews)
    .where(eq(readyCardViews.visitorKey, visitorKey))
    .orderBy(desc(readyCardViews.seenAt), desc(readyCardViews.id))
    .limit(retainedViewsPerVisitor)

  if (retainedRows.length < retainedViewsPerVisitor) return

  await client.db
    .delete(readyCardViews)
    .where(
      and(
        eq(readyCardViews.visitorKey, visitorKey),
        notInArray(
          readyCardViews.id,
          retainedRows.map((row) => row.id)
        )
      )
    )
}

async function getNextReadyCardForVisitorInTransaction(
  client: DatabaseClient,
  context: ReadyCardRequestContext
) {
  const now = Date.now()

  await client.db
    .delete(readyCardViews)
    .where(
      and(
        eq(readyCardViews.visitorKey, context.visitorKey),
        gt(readyCardViews.seenAt, new Date(now + 60_000))
      )
    )

  const readyCards = await loadReadyCards(client)
  if (readyCards.length === 0) return null

  const recentViews = await loadRecentViews(client, context.visitorKey)
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

  const latestSeenAt = Math.min(recentViews[0]?.seenAt.getTime() ?? 0, now)
  const nextSeenAt = new Date(Math.max(now, latestSeenAt + 1))

  await client.db.insert(readyCardViews).values({
    id: randomUUID(),
    visitorKey: context.visitorKey,
    cardId: selected.id,
    seenAt: nextSeenAt,
  })
  await pruneVisitorViews(client, context.visitorKey)

  return toPublicReadyCard(selected)
}

export async function getNextReadyCardForVisitor(
  client: DatabaseClient,
  context: ReadyCardRequestContext
): Promise<PublicReadyCard | null> {
  return runImmediateTransaction(client, () =>
    getNextReadyCardForVisitorInTransaction(client, context)
  )
}
