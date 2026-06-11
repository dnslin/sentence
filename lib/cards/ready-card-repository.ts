import { asc, eq } from "drizzle-orm"

import { isReadyCardAccent, type PublicReadyCard } from "./public-ready-card"

import { cards, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

type ReadyCardRow = {
  id: string
  sentence: string
  sceneLabel: string
  accent: string
  status: string
}

function toPublicReadyCard(row: ReadyCardRow): PublicReadyCard {
  if (row.status !== "ready") {
    throw new Error(`Unexpected ready card status: ${row.status}`)
  }

  if (!isReadyCardAccent(row.accent)) {
    throw new Error(`Unexpected ready card accent: ${row.accent}`)
  }

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
    .where(eq(cards.status, "ready"))
    .orderBy(asc(cards.createdAt))
    .limit(1)

  if (!row) return null

  return toPublicReadyCard(row)
}
