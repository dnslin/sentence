import { and, count, eq, inArray, sql } from "drizzle-orm"

import { readyCardAccents } from "@/lib/cards/public-ready-card"
import { runImmediateTransaction, type DatabaseClient } from "@/lib/db/client"
import { cards, readyPoolGenerationDays, sentences } from "@/lib/db/schema"

export type DailyGenerationReservation =
  | { status: "reserved"; dayKey: string; generationCount: number }
  | { status: "cap_exhausted"; dayKey: string; generationCount: number }

export async function countReadyPoolInventory(client: DatabaseClient) {
  const [row] = await client.db
    .select({ value: count() })
    .from(cards)
    .innerJoin(sentences, eq(cards.sentenceId, sentences.id))
    .where(
      and(eq(cards.status, "ready"), inArray(cards.accent, readyCardAccents))
    )

  return row?.value ?? 0
}

export async function reserveDailyGenerationCapacity(input: {
  client: DatabaseClient
  dayKey: string
  dailyCap: number
  now: Date
}): Promise<DailyGenerationReservation> {
  return runImmediateTransaction(input.client, async () => {
    const [existing] = await input.client.db
      .select({ generationCount: readyPoolGenerationDays.generationCount })
      .from(readyPoolGenerationDays)
      .where(eq(readyPoolGenerationDays.dayKey, input.dayKey))
      .limit(1)

    const currentCount = existing?.generationCount ?? 0
    if (currentCount >= input.dailyCap) {
      return {
        status: "cap_exhausted",
        dayKey: input.dayKey,
        generationCount: currentCount,
      }
    }

    const nextCount = currentCount + 1

    await input.client.db
      .insert(readyPoolGenerationDays)
      .values({
        dayKey: input.dayKey,
        generationCount: nextCount,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: readyPoolGenerationDays.dayKey,
        set: {
          generationCount: sql.raw("generation_count + 1"),
          updatedAt: input.now,
        },
      })

    return {
      status: "reserved",
      dayKey: input.dayKey,
      generationCount: nextCount,
    }
  })
}
