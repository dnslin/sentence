import { generateReadyCardForHitokotoSentence } from "@/lib/generation/xai-generation-pipeline"
import { createProductionXaiClient } from "@/lib/generation/xai-client"
import {
  countReadyPoolInventory,
  reserveDailyGenerationCapacity,
} from "./ready-pool-repository"

import type { DatabaseClient } from "@/lib/db/client"
import type { XaiReadyCardGenerationResult } from "@/lib/generation/xai-generation-pipeline"

export const readyPoolReplenishThreshold = 50
export const readyPoolTargetInventory = 200
export const readyPoolDailyGenerationCap = 250
export const readyPoolGenerationConcurrency = 1
export const readyPoolWorkerIntervalMs = 60_000

export type ReadyPoolSkippedReason =
  | "inventory_above_threshold"
  | "daily_cap_exhausted"
  | "stopped"
  | null

export type ReadyPoolReplenishmentSummary = {
  startedInventory: number
  endingInventory: number
  threshold: typeof readyPoolReplenishThreshold
  target: typeof readyPoolTargetInventory
  dailyCap: typeof readyPoolDailyGenerationCap
  generatedReadyCount: number
  failedCount: number
  reservedCount: number
  skippedReason: ReadyPoolSkippedReason
}

export type ReadyPoolGenerator = () => Promise<XaiReadyCardGenerationResult>

export type ReadyPoolClock = () => Date

export type ReadyPoolStopSignal = {
  readonly stopped: boolean
}

export function getUtcDayKey(now: Date) {
  return now.toISOString().slice(0, 10)
}

function createSummary(
  startedInventory: number
): ReadyPoolReplenishmentSummary {
  return {
    startedInventory,
    endingInventory: startedInventory,
    threshold: readyPoolReplenishThreshold,
    target: readyPoolTargetInventory,
    dailyCap: readyPoolDailyGenerationCap,
    generatedReadyCount: 0,
    failedCount: 0,
    reservedCount: 0,
    skippedReason: null,
  }
}

export function createProductionReadyPoolGenerator(
  client: DatabaseClient
): ReadyPoolGenerator {
  const xaiClient = createProductionXaiClient()

  return () => generateReadyCardForHitokotoSentence({ client, xaiClient })
}

export async function replenishReadyPoolOnce(input: {
  client: DatabaseClient
  generateReadyCard: ReadyPoolGenerator
  now?: ReadyPoolClock
  stopSignal?: ReadyPoolStopSignal
}): Promise<ReadyPoolReplenishmentSummary> {
  const now = input.now ?? (() => new Date())
  const startedInventory = await countReadyPoolInventory(input.client)
  const summary = createSummary(startedInventory)

  if (startedInventory >= readyPoolReplenishThreshold) {
    summary.skippedReason = "inventory_above_threshold"
    return summary
  }

  let inventory = startedInventory

  while (inventory < readyPoolTargetInventory) {
    if (input.stopSignal?.stopped) {
      summary.skippedReason = "stopped"
      break
    }

    const reservationTime = now()
    const reservation = await reserveDailyGenerationCapacity({
      client: input.client,
      dayKey: getUtcDayKey(reservationTime),
      dailyCap: readyPoolDailyGenerationCap,
      now: reservationTime,
    })

    if (reservation.status === "cap_exhausted") {
      summary.skippedReason = "daily_cap_exhausted"
      break
    }

    summary.reservedCount += 1

    try {
      const result = await input.generateReadyCard()
      if (result.status === "ready") {
        summary.generatedReadyCount += 1
      } else {
        summary.failedCount += 1
      }
    } catch {
      summary.failedCount += 1
    }

    inventory = await countReadyPoolInventory(input.client)
    summary.endingInventory = inventory
  }

  summary.endingInventory = await countReadyPoolInventory(input.client)
  return summary
}

export async function runReadyPoolWorkerLoop(input: {
  client: DatabaseClient
  generateReadyCard?: ReadyPoolGenerator
  now?: ReadyPoolClock
  sleep?: (durationMs: number) => Promise<void>
  stopSignal?: ReadyPoolStopSignal
  onSummary?: (summary: ReadyPoolReplenishmentSummary) => void
}) {
  const generateReadyCard =
    input.generateReadyCard ?? createProductionReadyPoolGenerator(input.client)
  const sleep =
    input.sleep ??
    ((durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)))

  while (!input.stopSignal?.stopped) {
    const summary = await replenishReadyPoolOnce({
      client: input.client,
      generateReadyCard,
      now: input.now,
      stopSignal: input.stopSignal,
    })
    input.onSummary?.(summary)

    if (input.stopSignal?.stopped) break
    await sleep(readyPoolWorkerIntervalMs)
  }
}
