import { and, asc, eq, inArray } from "drizzle-orm"

import { readyCardAccents, type PublicReadyCard } from "./public-ready-card"

import { cards, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

type ReadyCardRow = {
  id: string
  sentence: string
  sceneLabel: string
  accent: PublicReadyCard["accent"]
  status: PublicReadyCard["status"]
}

function toPublicReadyCard(row: ReadyCardRow): PublicReadyCard {
  return {
    id: row.id,
    sentence: row.sentence,
    sceneLabel: row.sceneLabel,
    accent: row.accent,
    status: row.status,
  }
}

export async function getOneReadyCard(client: DatabaseClient): Promise<PublicReadyCard | null> {
  const [row] = await client.db
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
    .limit(1)

  if (!row) return null

  return toPublicReadyCard(row as ReadyCardRow)
}
