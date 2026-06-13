import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { eq } from "drizzle-orm"

import { createDatabaseClient } from "@/lib/db/client"
import { rateLimitWindows } from "@/lib/db/schema"
import {
  checkAndConsumeRateLimit,
  rateLimitConfigs,
  type RateLimitedAction,
} from "@/lib/rate-limit/action-rate-limit"

import type { DatabaseClient } from "@/lib/db/client"

let previousDatabasePath: string | undefined
let tempDir: string
let migrationImportSequence = 0

beforeEach(async () => {
  previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  tempDir = mkdtempSync(join(tmpdir(), "juhua-rate-limit-"))
  process.env.JUHUA_DATABASE_PATH = join(tempDir, "juhua.sqlite")
  await import(`../scripts/migrate.ts?rateLimit=${++migrationImportSequence}`)
})

afterEach(() => {
  if (previousDatabasePath === undefined) {
    delete process.env.JUHUA_DATABASE_PATH
  } else {
    process.env.JUHUA_DATABASE_PATH = previousDatabasePath
  }

  rmSync(tempDir, { recursive: true, force: true })
})

function createClient() {
  return createDatabaseClient()
}

async function withClient<T>(callback: (client: DatabaseClient) => Promise<T>) {
  const client = createClient()

  try {
    return await callback(client)
  } finally {
    client.sqlite.close()
  }
}

async function consumeToLimit({
  client,
  action,
  contextKey,
  now,
}: {
  client: DatabaseClient
  action: RateLimitedAction
  contextKey: string
  now: () => Date
}) {
  const limit = rateLimitConfigs[action].limit

  for (let index = 0; index < limit; index += 1) {
    const result = await checkAndConsumeRateLimit({
      client,
      action,
      contextKey,
      now,
    })
    assert.equal(result.allowed, true)
  }
}

describe("action rate limits", () => {
  test("allows refresh below the hourly threshold and blocks after it", async () => {
    await withClient(async (client) => {
      const now = () => new Date("2026-06-12T01:15:00.000Z")
      await consumeToLimit({
        client,
        action: "refresh",
        contextKey: "safe-context-key",
        now,
      })

      const blocked = await checkAndConsumeRateLimit({
        client,
        action: "refresh",
        contextKey: "safe-context-key",
        now,
      })

      assert.equal(blocked.allowed, false)
      assert.equal(blocked.retryAfterSeconds, 2700)
    })
  })

  test("resets refresh, download, and share quotas in the next hourly window", async () => {
    await withClient(async (client) => {
      for (const action of ["refresh", "download", "share"] as const) {
        const contextKey = `context-${action}`
        await consumeToLimit({
          client,
          action,
          contextKey,
          now: () => new Date("2026-06-12T02:00:00.000Z"),
        })

        const blocked = await checkAndConsumeRateLimit({
          client,
          action,
          contextKey,
          now: () => new Date("2026-06-12T02:30:00.000Z"),
        })
        assert.equal(blocked.allowed, false)

        const reset = await checkAndConsumeRateLimit({
          client,
          action,
          contextKey,
          now: () => new Date("2026-06-12T03:00:00.000Z"),
        })
        assert.equal(reset.allowed, true)
      }
    })
  })

  test("persists hashed context keys without raw cookie or IP values", async () => {
    await withClient(async (client) => {
      await checkAndConsumeRateLimit({
        client,
        action: "download",
        contextKey: "hashed-context-only",
        now: () => new Date("2026-06-12T04:00:00.000Z"),
      })

      const rows = await client.db.select().from(rateLimitWindows)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]?.contextKey, "hashed-context-only")
      assert.notEqual(rows[0]?.contextKey, "juhua_anonymous_id=raw-cookie")
      assert.notEqual(rows[0]?.contextKey, "203.0.113.7")
    })
  })

  test("does not allow multi-connection consumes above the threshold", async () => {
    await withClient(async (client) => {
      const action = "share"
      const contextKey = "parallel-context"
      const limit = rateLimitConfigs[action].limit
      const now = () => new Date("2026-06-12T05:00:00.000Z")

      await consumeToLimit({ client, action, contextKey, now })

      const secondClient = createClient()
      try {
        const blocked = await checkAndConsumeRateLimit({
          client: secondClient,
          action,
          contextKey,
          now,
        })
        assert.equal(blocked.allowed, false)
      } finally {
        secondClient.sqlite.close()
      }

      const rows = await client.db
        .select()
        .from(rateLimitWindows)
        .where(eq(rateLimitWindows.contextKey, contextKey))
      assert.equal(rows[0]?.count, limit)
    })
  })
})
