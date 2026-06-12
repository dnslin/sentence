import { eq, sql } from "drizzle-orm"

import { countPublicReadyCards } from "@/lib/cards/ready-card-repository"
import { runImmediateTransaction, type DatabaseClient } from "@/lib/db/client"
import { readyPoolGenerationDays } from "@/lib/db/schema"

export { countPublicReadyCards as countReadyPoolInventory }

export type DailyGenerationReservation =
  | { status: "reserved"; dayKey: string; generationCount: number }
  | { status: "cap_exhausted"; dayKey: string; generationCount: number }

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
