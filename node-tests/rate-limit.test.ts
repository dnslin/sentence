import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { count, eq } from "drizzle-orm"

import {
  createReadyCardRequestContext,
  anonymousCookieName,
} from "@/lib/cards/ready-card-request-context"
import { getRateLimitedNextReadyCardForVisitor } from "@/lib/cards/rate-limited-ready-card"
import { createDatabaseClient } from "@/lib/db/client"
import { rateLimitWindows } from "@/lib/db/schema"
import {
  checkAndConsumeRateLimit,
  rateLimitConfigs,
  rateLimitedActions,
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
      for (const action of rateLimitedActions) {
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

  test("ignores spoofable x-forwarded-for when deriving rate-limit context", () => {
    const cookieValue = "00000000-0000-4000-8000-000000000001"
    const cookiesList = { get: () => ({ value: cookieValue }) }
    const firstContext = createReadyCardRequestContext({
      cookiesList,
      headersList: {
        get: (name) => (name === "x-forwarded-for" ? "198.51.100.1" : null),
      },
    })
    const secondContext = createReadyCardRequestContext({
      cookiesList,
      headersList: {
        get: (name) => (name === "x-forwarded-for" ? "203.0.113.7" : null),
      },
    })
    const trustedIpContext = createReadyCardRequestContext({
      cookiesList,
      headersList: {
        get: (name) => (name === "x-real-ip" ? "203.0.113.7" : null),
      },
    })

    assert.equal(firstContext.visitorKey, secondContext.visitorKey)
    assert.equal(
      firstContext.requestContextKey,
      secondContext.requestContextKey
    )
    assert.notEqual(
      firstContext.requestContextKey,
      trustedIpContext.requestContextKey
    )
  })

  test("prunes expired rate-limit windows during bounded hot-path cleanup", async () => {
    await withClient(async (client) => {
      await checkAndConsumeRateLimit({
        client,
        action: "refresh",
        contextKey: "old-context",
        now: () => new Date("2026-06-08T00:00:00.000Z"),
      })
      await checkAndConsumeRateLimit({
        client,
        action: "refresh",
        contextKey: "current-context",
        now: () => new Date("2026-06-12T00:00:00.000Z"),
      })

      const rows = await client.db.select().from(rateLimitWindows)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]?.contextKey, "current-context")
    })
  })

  test("rolls back consumed refresh quota when ready-card selection fails", async () => {
    await withClient(async (client) => {
      const context = createReadyCardRequestContext({
        cookiesList: {
          get: (name) =>
            name === anonymousCookieName
              ? { value: "00000000-0000-4000-8000-000000000002" }
              : undefined,
        },
        headersList: { get: () => null },
      })

      client.sqlite.exec("DROP TABLE ready_card_views")

      await assert.rejects(
        getRateLimitedNextReadyCardForVisitor({
          client,
          context,
          now: () => new Date("2026-06-12T06:00:00.000Z"),
        })
      )

      const [windowCount] = await client.db
        .select({ value: count() })
        .from(rateLimitWindows)
      assert.equal(windowCount?.value, 0)
    })
  })
})
