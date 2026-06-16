import { generateReadyCardForHitokotoSentence } from "@/lib/generation/xai-generation-pipeline"
import { createProductionXaiClient } from "@/lib/generation/xai-client"
import { sanitizeErrorMessage } from "@/lib/generation/generation-attempt-repository"
import {
  countReadyPoolInventory,
  reserveDailyGenerationCapacity,
} from "./ready-pool-repository"

import type { DatabaseClient } from "@/lib/db/client"
import type { XaiReadyCardGenerationResult } from "@/lib/generation/xai-generation-pipeline"

export const readyPoolReplenishThreshold = 50
export const readyPoolTargetInventory = 200
export const readyPoolDailyGenerationCap = 250
export const readyPoolWorkerIntervalMs = 60_000

export type ReadyPoolSkippedReason =
  | "inventory_above_threshold"
  | "daily_cap_exhausted"
  | "stopped"
  | null

export type ReadyPoolErrorSummary = {
  stage: "generation_exception" | "replenishment_pass" | "summary_observer"
  message: string
}

export type ReadyPoolProgressEvent =
  | {
      event: "generation_started"
      inventory: number
      remainingToTarget: number
      threshold: typeof readyPoolReplenishThreshold
      target: typeof readyPoolTargetInventory
      dailyCap: typeof readyPoolDailyGenerationCap
      reservedCount: number
    }
  | {
      event: "generation_finished"
      status: XaiReadyCardGenerationResult["status"] | "exception"
      attemptId: string | null
      cardId: string | null
      errorStage: string | null
      errorMessage: string | null
      inventoryBefore: number
      inventoryAfter: number
      inventoryGrowth: number
      remainingToTarget: number
      readyInventoryGrowthCount: number
      failedCount: number
      reservedCount: number
    }

export type ReadyPoolProgressReporter = (
  progress: ReadyPoolProgressEvent
) => void

export type ReadyPoolReplenishmentSummary = {
  startedInventory: number
  endingInventory: number
  threshold: typeof readyPoolReplenishThreshold
  target: typeof readyPoolTargetInventory
  dailyCap: typeof readyPoolDailyGenerationCap
  readyInventoryGrowthCount: number
  failedCount: number
  reservedCount: number
  skippedReason: ReadyPoolSkippedReason
  errors: ReadyPoolErrorSummary[]
}

export type ReadyPoolGenerator = () => Promise<XaiReadyCardGenerationResult>

export type ReadyPoolClock = () => Date

export type ReadyPoolStopSignal = {
  readonly stopped: boolean
}

export type ReadyPoolSleep = (input: {
  durationMs: number
  stopSignal?: ReadyPoolStopSignal
}) => Promise<void>

export type ReadyPoolErrorReporter = (error: ReadyPoolErrorSummary) => void

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
    readyInventoryGrowthCount: 0,
    failedCount: 0,
    reservedCount: 0,
    skippedReason: null,
    errors: [],
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function createErrorSummary(
  stage: ReadyPoolErrorSummary["stage"],
  error: unknown
): ReadyPoolErrorSummary {
  return {
    stage,
    message: sanitizeErrorMessage(toErrorMessage(error)),
  }
}

function createGenerationFinishedProgress(input: {
  result: XaiReadyCardGenerationResult | null
  error: ReadyPoolErrorSummary | null
  inventoryBefore: number
  inventoryAfter: number
  inventoryGrowth: number
  summary: ReadyPoolReplenishmentSummary
}): ReadyPoolProgressEvent {
  const failedResult = input.result?.status === "failed" ? input.result : null
  const readyResult = input.result?.status === "ready" ? input.result : null

  return {
    event: "generation_finished",
    status: input.error ? "exception" : (input.result?.status ?? "exception"),
    attemptId: input.result?.attemptId ?? null,
    cardId: readyResult?.card.id ?? null,
    errorStage: input.error?.stage ?? failedResult?.error.stage ?? null,
    errorMessage:
      input.error?.message ??
      (failedResult ? sanitizeErrorMessage(failedResult.error.message) : null),
    inventoryBefore: input.inventoryBefore,
    inventoryAfter: input.inventoryAfter,
    inventoryGrowth: input.inventoryGrowth,
    remainingToTarget: Math.max(
      0,
      readyPoolTargetInventory - input.inventoryAfter
    ),
    readyInventoryGrowthCount: input.summary.readyInventoryGrowthCount,
    failedCount: input.summary.failedCount,
    reservedCount: input.summary.reservedCount,
  }
}

function reportError(
  reporter: ReadyPoolErrorReporter | undefined,
  error: ReadyPoolErrorSummary
) {
  try {
    if (reporter) {
      reporter(error)
      return
    }
  } catch (reporterError) {
    console.error(
      JSON.stringify(createErrorSummary("summary_observer", reporterError))
    )
  }

  console.error(JSON.stringify(error))
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
  onProgress?: ReadyPoolProgressReporter
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
    const inventoryBeforeGeneration = inventory

    input.onProgress?.({
      event: "generation_started",
      inventory: inventoryBeforeGeneration,
      remainingToTarget: Math.max(
        0,
        readyPoolTargetInventory - inventoryBeforeGeneration
      ),
      threshold: readyPoolReplenishThreshold,
      target: readyPoolTargetInventory,
      dailyCap: readyPoolDailyGenerationCap,
      reservedCount: summary.reservedCount,
    })

    let result: XaiReadyCardGenerationResult | null = null
    let generationError: ReadyPoolErrorSummary | null = null

    try {
      result = await input.generateReadyCard()
      if (result.status === "failed") {
        summary.failedCount += 1
      }
    } catch (error) {
      summary.failedCount += 1
      generationError = createErrorSummary("generation_exception", error)
      summary.errors.push(generationError)
    }

    const nextInventory = await countReadyPoolInventory(input.client)
    const inventoryGrowth = Math.max(0, nextInventory - inventory)
    summary.readyInventoryGrowthCount += inventoryGrowth
    inventory = nextInventory
    summary.endingInventory = inventory

    input.onProgress?.(
      createGenerationFinishedProgress({
        result,
        error: generationError,
        inventoryBefore: inventoryBeforeGeneration,
        inventoryAfter: nextInventory,
        inventoryGrowth,
        summary,
      })
    )
  }

  return summary
}

export async function runReadyPoolWorkerLoop(input: {
  client: DatabaseClient
  generateReadyCard?: ReadyPoolGenerator
  now?: ReadyPoolClock
  sleep?: ReadyPoolSleep
  stopSignal?: ReadyPoolStopSignal
  onProgress?: ReadyPoolProgressReporter
  onSummary?: (summary: ReadyPoolReplenishmentSummary) => void
  onError?: ReadyPoolErrorReporter
}) {
  const generateReadyCard =
    input.generateReadyCard ?? createProductionReadyPoolGenerator(input.client)
  const sleep: ReadyPoolSleep =
    input.sleep ??
    (({ durationMs }) =>
      new Promise((resolve) => setTimeout(resolve, durationMs)))

  while (!input.stopSignal?.stopped) {
    try {
      const summary = await replenishReadyPoolOnce({
        client: input.client,
        generateReadyCard,
        now: input.now,
        stopSignal: input.stopSignal,
        onProgress: input.onProgress,
      })

      try {
        input.onSummary?.(summary)
      } catch (error) {
        reportError(
          input.onError,
          createErrorSummary("summary_observer", error)
        )
      }
    } catch (error) {
      reportError(
        input.onError,
        createErrorSummary("replenishment_pass", error)
      )
    }

    if (input.stopSignal?.stopped) break
    await sleep({
      durationMs: readyPoolWorkerIntervalMs,
      stopSignal: input.stopSignal,
    })
  }
}
