import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { eq } from "drizzle-orm"

import { createDatabaseClient } from "@/lib/db/client"
import { cards, generationAttempts, sentences } from "@/lib/db/schema"
import {
  readyPoolDailyGenerationCap,
  readyPoolTargetInventory,
  replenishReadyPoolOnce,
  runReadyPoolWorkerLoop,
  type ReadyPoolErrorSummary,
  type ReadyPoolGenerator,
} from "@/lib/worker/ready-pool-worker"

import type { DatabaseClient } from "@/lib/db/client"
import type { XaiReadyCardGenerationResult } from "@/lib/generation/xai-generation-pipeline"

let previousDatabasePath: string | undefined
let tempDir: string
let client: DatabaseClient
let migrationImportSequence = 0
let cardSequence = 0

beforeEach(async () => {
  previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  tempDir = mkdtempSync(join(tmpdir(), "juhua-worker-"))
  process.env.JUHUA_DATABASE_PATH = join(tempDir, "juhua.sqlite")
  await import(`../scripts/migrate.ts?worker=${++migrationImportSequence}`)
  client = createDatabaseClient()
  cardSequence = 0
})

afterEach(() => {
  client.sqlite.close()

  if (previousDatabasePath === undefined) {
    delete process.env.JUHUA_DATABASE_PATH
  } else {
    process.env.JUHUA_DATABASE_PATH = previousDatabasePath
  }

  rmSync(tempDir, { recursive: true, force: true })
})

function createReadyResult(cardId: string): XaiReadyCardGenerationResult {
  return {
    attemptId: randomUUID(),
    status: "ready",
    sentence: { id: randomUUID(), text: "山河远阔，人间烟火" },
    prompt: { source: "rewrite", text: "quiet picture-book scene" },
    imageGenerationAttempts: 1,
    illustration: {
      publicPath: `/generated-illustrations/${randomUUID()}.webp`,
      byteLength: 10,
      sha256: "a".repeat(64),
    },
    card: {
      id: cardId,
      sentence: "山河远阔，人间烟火",
      sceneLabel: "非署名绘本风插画",
      accent: "dawn",
      status: "ready",
      illustrationUrl: null,
    },
  }
}

function createFailedResult(): XaiReadyCardGenerationResult {
  return {
    attemptId: randomUUID(),
    status: "failed",
    sentence: { id: randomUUID(), text: "山河远阔，人间烟火" },
    prompt: { source: "fallback", text: "fallback prompt" },
    error: { stage: "image_generation", message: "controlled failure" },
  }
}

async function insertReadyCard(label: string) {
  const now = new Date(Date.UTC(2026, 5, 12, 0, 0, cardSequence++))
  const sentenceId = `sentence-${label}`
  const cardId = `card-${label}`

  await client.db.insert(sentences).values({
    id: sentenceId,
    text: `测试短句 ${label}`,
    source: "test",
    createdAt: now,
  })
  await client.db.insert(cards).values({
    id: cardId,
    sentenceId,
    status: "ready",
    sceneLabel: "非署名绘本风插画",
    accent: "dawn",
    illustrationPath: null,
    styleVersion: `test-style-${label}`,
    createdAt: now,
    updatedAt: now,
  })

  return cardId
}

async function seedReadyCards(count: number) {
  for (let index = 0; index < count; index += 1) {
    await insertReadyCard(`${index}`)
  }
}

async function countCards() {
  return client.db.select().from(cards)
}

async function recordInspectableFailure() {
  const sentenceId = `failed-sentence-${randomUUID()}`
  const now = new Date()
  await client.db.insert(sentences).values({
    id: sentenceId,
    text: "失败仍可检查",
    source: "test",
    createdAt: now,
  })
  await client.db.insert(generationAttempts).values({
    id: randomUUID(),
    sentenceId,
    status: "failed",
    promptModel: "test-prompt-model",
    imageModel: "test-image-model",
    promptText: "safe prompt",
    promptSource: "fallback",
    imageMimeType: null,
    imageByteLength: null,
    imageSha256: null,
    errorStage: "image_generation",
    errorMessage: "controlled failure",
    imageGenerationAttempts: 1,
    createdAt: now,
    updatedAt: now,
  })
}

describe("ready-pool worker", () => {
  test("below-threshold replenishment reaches the target inventory", async () => {
    await seedReadyCards(49)

    const generator: ReadyPoolGenerator = async () => {
      const cardId = await insertReadyCard(`generated-${cardSequence}`)
      return createReadyResult(cardId)
    }

    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
      now: () => new Date("2026-06-12T00:00:00.000Z"),
    })

    assert.equal(summary.startedInventory, 49)
    assert.equal(summary.endingInventory, readyPoolTargetInventory)
    assert.equal(summary.readyInventoryGrowthCount, 151)
    assert.equal(summary.failedCount, 0)
    assert.equal(summary.reservedCount, 151)
    assert.equal(summary.skippedReason, null)
    assert.equal((await countCards()).length, readyPoolTargetInventory)
  })

  test("at-threshold inventory skips generation", async () => {
    await seedReadyCards(50)
    let calls = 0

    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: async () => {
        calls += 1
        throw new Error("generator should not run")
      },
    })

    assert.equal(calls, 0)
    assert.equal(summary.startedInventory, 50)
    assert.equal(summary.endingInventory, 50)
    assert.equal(summary.skippedReason, "inventory_above_threshold")
  })

  test("worker generation jobs do not overlap within one replenishment pass", async () => {
    await seedReadyCards(49)
    let activeCalls = 0
    let maxActiveCalls = 0

    const generator: ReadyPoolGenerator = async () => {
      activeCalls += 1
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls)
      await Promise.resolve()
      const cardId = await insertReadyCard(`sequential-${cardSequence}`)
      activeCalls -= 1
      return createReadyResult(cardId)
    }

    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
    })

    assert.equal(summary.endingInventory, readyPoolTargetInventory)
    assert.equal(maxActiveCalls, 1)
  })

  test("daily cap reservations persist across reopened database connections", async () => {
    const capDay = new Date("2026-06-12T12:00:00.000Z")
    await seedReadyCards(49)
    let calls = 0

    const generator: ReadyPoolGenerator = async () => {
      calls += 1
      const cardId = await insertReadyCard(`capped-${cardSequence}`)
      return createReadyResult(cardId)
    }

    const first = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
      now: () => capDay,
    })

    assert.equal(first.endingInventory, readyPoolTargetInventory)
    assert.equal(calls, 151)

    client.sqlite.close()
    client = createDatabaseClient()

    const second = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
      now: () => capDay,
    })

    assert.equal(second.skippedReason, "inventory_above_threshold")

    client.sqlite.close()
    client = createDatabaseClient()
    await client.db.delete(cards)
    await client.db.delete(sentences)
    await seedReadyCards(49)

    const third = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
      now: () => capDay,
    })

    assert.equal(third.reservedCount, readyPoolDailyGenerationCap - 151)
    assert.equal(third.skippedReason, "daily_cap_exhausted")
    assert.equal(calls, readyPoolDailyGenerationCap)

    client.sqlite.close()
    client = createDatabaseClient()
    await client.db.delete(cards)
    await client.db.delete(sentences)
    await seedReadyCards(49)

    const beforeSameDayCalls = calls
    const fourth = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
      now: () => capDay,
    })

    assert.equal(fourth.reservedCount, 0)
    assert.equal(fourth.skippedReason, "daily_cap_exhausted")
    assert.equal(calls, beforeSameDayCalls)
  })

  test("failed generations remain inspectable and excluded from ready inventory", async () => {
    await seedReadyCards(49)
    let calls = 0

    const generator: ReadyPoolGenerator = async () => {
      calls += 1
      if (calls <= 2) {
        await recordInspectableFailure()
        return createFailedResult()
      }

      const cardId = await insertReadyCard(`after-failure-${cardSequence}`)
      return createReadyResult(cardId)
    }

    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: generator,
    })

    assert.equal(summary.failedCount, 2)
    assert.equal(summary.readyInventoryGrowthCount, 151)
    assert.equal(summary.reservedCount, 153)
    assert.equal(summary.endingInventory, readyPoolTargetInventory)

    const failedAttempts = await client.db
      .select()
      .from(generationAttempts)
      .where(eq(generationAttempts.status, "failed"))
    assert.equal(failedAttempts.length, 2)
    assert.equal((await countCards()).length, readyPoolTargetInventory)
  })

  test("thrown generator errors are counted and reported with sanitized diagnostics", async () => {
    await seedReadyCards(49)
    const secret = "xai-secret-token-123456789"
    let calls = 0

    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: async () => {
        calls += 1
        if (calls === 1) {
          throw new Error(`provider failed with Bearer ${secret}`)
        }

        const cardId = await insertReadyCard(`after-throw-${cardSequence}`)
        return createReadyResult(cardId)
      },
    })

    assert.equal(summary.failedCount, 1)
    assert.equal(summary.reservedCount, 152)
    assert.equal(summary.readyInventoryGrowthCount, 151)
    assert.equal(summary.errors.length, 1)
    assert.equal(summary.errors[0]?.stage, "generation_exception")
    assert.match(summary.errors[0]?.message ?? "", /\[redacted\]/)
    assert.doesNotMatch(JSON.stringify(summary), new RegExp(secret))
  })

  test("ready inventory growth ignores ready results that do not add inventory", async () => {
    await seedReadyCards(49)
    let calls = 0

    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: async () => {
        calls += 1
        return createReadyResult(`duplicate-${calls}`)
      },
      now: () => new Date("2026-06-12T00:00:00.000Z"),
    })

    assert.equal(summary.readyInventoryGrowthCount, 0)
    assert.equal(summary.failedCount, 0)
    assert.equal(summary.reservedCount, readyPoolDailyGenerationCap)
    assert.equal(summary.endingInventory, 49)
    assert.equal(summary.skippedReason, "daily_cap_exhausted")
  })

  test("worker inventory count shares public ready-card eligibility", async () => {
    await seedReadyCards(49)
    const sentenceId = "invalid-accent-sentence"
    await client.db.insert(sentences).values({
      id: sentenceId,
      text: "无效强调色不应入池",
      source: "test",
      createdAt: new Date(),
    })
    client.sqlite.exec("PRAGMA ignore_check_constraints = ON")
    try {
      await client.db.insert(cards).values({
        id: "invalid-accent-card",
        sentenceId,
        status: "ready",
        sceneLabel: "非署名绘本风插画",
        accent: "bad-accent",
        illustrationPath: null,
        styleVersion: "invalid-accent-style",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } finally {
      client.sqlite.exec("PRAGMA ignore_check_constraints = OFF")
    }

    let calls = 0
    const summary = await replenishReadyPoolOnce({
      client,
      generateReadyCard: async () => {
        calls += 1
        const cardId = await insertReadyCard(`shared-count-${cardSequence}`)
        return createReadyResult(cardId)
      },
    })

    assert.equal(summary.startedInventory, 49)
    assert.equal(summary.endingInventory, readyPoolTargetInventory)
    assert.equal(calls, 151)
  })

  test("worker loop survives pass errors and later iterations continue", async () => {
    const errors: ReadyPoolErrorSummary[] = []
    let sleepCalls = 0
    let shouldThrow = true
    const loopStopSignal = { stopped: false }

    await runReadyPoolWorkerLoop({
      client,
      generateReadyCard: async () => createFailedResult(),
      stopSignal: loopStopSignal,
      onError: (error) => errors.push(error),
      sleep: async () => {
        sleepCalls += 1
        if (sleepCalls === 1) {
          shouldThrow = false
          return
        }
        loopStopSignal.stopped = true
      },
      now: () => {
        if (shouldThrow) throw new Error("sqlite transient failure")
        return new Date("2026-06-12T00:00:00.000Z")
      },
    })

    assert.equal(errors.length, 1)
    assert.equal(errors[0]?.stage, "replenishment_pass")
    assert.equal(sleepCalls, 2)
  })

  test("onSummary failures are isolated from the worker loop", async () => {
    await seedReadyCards(50)
    const errors: ReadyPoolErrorSummary[] = []
    const loopStopSignal = { stopped: false }
    let summaries = 0
    let sleepCalls = 0

    await runReadyPoolWorkerLoop({
      client,
      generateReadyCard: async () => createFailedResult(),
      stopSignal: loopStopSignal,
      onSummary: () => {
        summaries += 1
        throw new Error("observer failed")
      },
      onError: (error) => errors.push(error),
      sleep: async () => {
        sleepCalls += 1
        loopStopSignal.stopped = true
      },
    })

    assert.equal(summaries, 1)
    assert.equal(errors.length, 1)
    assert.equal(errors[0]?.stage, "summary_observer")
    assert.equal(sleepCalls, 1)
  })

  test("stop-aware sleep lets the worker loop exit promptly", async () => {
    await seedReadyCards(50)
    const loopStopSignal = { stopped: false }
    let sleepCalls = 0

    await runReadyPoolWorkerLoop({
      client,
      generateReadyCard: async () => createFailedResult(),
      stopSignal: loopStopSignal,
      sleep: async ({ stopSignal }) => {
        sleepCalls += 1
        loopStopSignal.stopped = true
        assert.equal(stopSignal?.stopped, true)
      },
    })

    assert.equal(sleepCalls, 1)
  })
})
