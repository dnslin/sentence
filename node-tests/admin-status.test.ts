import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createDatabaseClient } from "@/lib/db/client"
import { cards, generationAttempts, sentences } from "@/lib/db/schema"
import {
  authorizeAdminStatusRequest,
  extractPresentedAdminToken,
  resolveAdminStatusToken,
  verifyAdminStatusToken,
} from "@/lib/admin/admin-auth"
import {
  collectOperationalCounts,
  collectOperationalStatus,
  collectRecentGenerationErrors,
  collectStorageIndicators,
} from "@/lib/admin/operational-status"
import {
  isAdminStatusResponse,
  isAdminStatusUnauthorizedResponse,
} from "@/lib/admin/admin-status-contract"

import { GET as adminStatusRoute } from "@/app/api/admin/status/route"

import type { DatabaseClient } from "@/lib/db/client"

let previousDatabasePath: string | undefined
let tempDir: string
let client: DatabaseClient
let migrationImportSequence = 0
let rowSequence = 0

async function withMigratedDatabase() {
  previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  tempDir = mkdtempSync(join(tmpdir(), "juhua-admin-status-"))
  process.env.JUHUA_DATABASE_PATH = join(tempDir, "juhua.sqlite")
  await import(`../scripts/migrate.ts?admin-status=${++migrationImportSequence}`)
  client = createDatabaseClient()
  rowSequence = 0
}

function teardownDatabase() {
  client.sqlite.close()

  if (previousDatabasePath === undefined) {
    delete process.env.JUHUA_DATABASE_PATH
  } else {
    process.env.JUHUA_DATABASE_PATH = previousDatabasePath
  }

  rmSync(tempDir, { recursive: true, force: true })
}

async function insertReadyCard(label: string) {
  const now = new Date(Date.UTC(2026, 5, 15, 0, 0, rowSequence++))
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
}

async function insertGenerationAttempt(input: {
  status: "started" | "prompt_fallback" | "image_generated" | "failed"
  errorStage?: string | null
  errorMessage?: string | null
  updatedAt?: Date
}) {
  const now = input.updatedAt ?? new Date(Date.UTC(2026, 5, 15, 0, 0, rowSequence))
  const sentenceId = `attempt-sentence-${rowSequence++}`

  await client.db.insert(sentences).values({
    id: sentenceId,
    text: "生成尝试短句",
    source: "test",
    createdAt: now,
  })
  await client.db.insert(generationAttempts).values({
    id: randomUUID(),
    sentenceId,
    status: input.status,
    promptModel: "test-prompt-model",
    imageModel: "test-image-model",
    promptText: "secret prompt text",
    promptSource: "fallback",
    imageMimeType: null,
    imageByteLength: null,
    imageSha256: null,
    errorStage: input.errorStage ?? null,
    errorMessage: input.errorMessage ?? null,
    imageGenerationAttempts: 1,
    createdAt: now,
    updatedAt: now,
  })
}

describe("admin status auth", () => {
  test("denies access when no admin token is configured even if one is presented", () => {
    const configuredToken = resolveAdminStatusToken({})

    const result = verifyAdminStatusToken({
      presentedToken: "anything",
      configuredToken,
    })

    assert.equal(configuredToken, null)
    assert.deepEqual(result, { authorized: false, reason: "not_configured" })
  })

  test("denies access when a token is configured but none is presented", () => {
    for (const presentedToken of [null, "", "   "]) {
      const result = verifyAdminStatusToken({
        presentedToken,
        configuredToken: "owner-secret",
      })

      assert.deepEqual(result, { authorized: false, reason: "missing_token" })
    }
  })

  test("authorizes only when the presented token matches the configured token", () => {
    assert.deepEqual(
      verifyAdminStatusToken({
        presentedToken: "owner-secret",
        configuredToken: "owner-secret",
      }),
      { authorized: true }
    )

    assert.deepEqual(
      verifyAdminStatusToken({
        presentedToken: "wrong-secret",
        configuredToken: "owner-secret",
      }),
      { authorized: false, reason: "invalid_token" }
    )

    // A presented token that shares a prefix but differs in length must not authorize.
    assert.deepEqual(
      verifyAdminStatusToken({
        presentedToken: "owner-secret-extra",
        configuredToken: "owner-secret",
      }),
      { authorized: false, reason: "invalid_token" }
    )
  })

  test("extracts the presented token from the Authorization header first", () => {
    const request = new Request("https://example.test/api/admin/status?token=from-query", {
      headers: { authorization: "Bearer from-header" },
    })

    assert.equal(extractPresentedAdminToken(request), "from-header")
  })

  test("accepts a case-insensitive Bearer scheme and trims the token", () => {
    const request = new Request("https://example.test/api/admin/status", {
      headers: { authorization: "bEaReR   spaced-token   " },
    })

    assert.equal(extractPresentedAdminToken(request), "spaced-token")
  })

  test("falls back to the token query parameter when no Authorization header is present", () => {
    const request = new Request(
      "https://example.test/admin/status?token=from-query"
    )

    assert.equal(extractPresentedAdminToken(request), "from-query")
  })

  test("returns null when neither a Bearer token nor a query token is usable", () => {
    const noToken = new Request("https://example.test/admin/status")
    assert.equal(extractPresentedAdminToken(noToken), null)

    const blankQuery = new Request("https://example.test/admin/status?token=%20%20")
    assert.equal(extractPresentedAdminToken(blankQuery), null)

    const nonBearer = new Request("https://example.test/admin/status", {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    })
    assert.equal(extractPresentedAdminToken(nonBearer), null)
  })

  test("authorizes an end-to-end request only with the configured token", () => {
    const env = { JUHUA_ADMIN_STATUS_TOKEN: "owner-secret" }

    const allowed = authorizeAdminStatusRequest({
      request: new Request("https://example.test/api/admin/status", {
        headers: { authorization: "Bearer owner-secret" },
      }),
      env,
    })
    assert.deepEqual(allowed, { authorized: true })

    const allowedByQuery = authorizeAdminStatusRequest({
      request: new Request(
        "https://example.test/admin/status?token=owner-secret"
      ),
      env,
    })
    assert.deepEqual(allowedByQuery, { authorized: true })

    const wrong = authorizeAdminStatusRequest({
      request: new Request("https://example.test/api/admin/status", {
        headers: { authorization: "Bearer nope" },
      }),
      env,
    })
    assert.deepEqual(wrong, { authorized: false, reason: "invalid_token" })

    const denied = authorizeAdminStatusRequest({
      request: new Request("https://example.test/api/admin/status"),
      env: {},
    })
    assert.deepEqual(denied, { authorized: false, reason: "not_configured" })
  })
})

describe("operational status data", () => {
  beforeEach(withMigratedDatabase)
  afterEach(teardownDatabase)

  test("counts ready cards, failed attempts, and in-progress attempts as database facts", async () => {
    await insertReadyCard("a")
    await insertReadyCard("b")
    await insertReadyCard("c")

    await insertGenerationAttempt({ status: "failed", errorStage: "image_generation", errorMessage: "boom" })
    await insertGenerationAttempt({ status: "failed", errorStage: "image_validation", errorMessage: "bad base64" })
    await insertGenerationAttempt({ status: "started" })
    await insertGenerationAttempt({ status: "prompt_fallback" })
    await insertGenerationAttempt({ status: "prompt_fallback" })
    // image_generated is neither failed nor in-progress for this view.
    await insertGenerationAttempt({ status: "image_generated" })

    const counts = await collectOperationalCounts(client)

    assert.deepEqual(counts, { ready: 3, failed: 2, inProgress: 3 })
  })

  test("returns only failed attempts, most recent first, bounded by the limit", async () => {
    await insertGenerationAttempt({
      status: "failed",
      errorStage: "image_generation",
      errorMessage: "oldest failure",
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    })
    await insertGenerationAttempt({
      status: "failed",
      errorStage: "image_validation",
      errorMessage: "middle failure",
      updatedAt: new Date("2026-06-15T01:00:00.000Z"),
    })
    await insertGenerationAttempt({
      status: "failed",
      errorStage: "image_storage",
      errorMessage: "newest failure",
      updatedAt: new Date("2026-06-15T02:00:00.000Z"),
    })
    // Non-failed attempts must never appear in the recent-errors view.
    await insertGenerationAttempt({ status: "prompt_fallback" })

    const errors = await collectRecentGenerationErrors({ client, limit: 2 })

    assert.equal(errors.length, 2)
    assert.equal(errors[0]?.stage, "image_storage")
    assert.equal(errors[0]?.message, "newest failure")
    assert.equal(errors[0]?.occurredAt, "2026-06-15T02:00:00.000Z")
    assert.equal(errors[1]?.stage, "image_validation")
    assert.equal(errors[1]?.message, "middle failure")
  })

  test("sanitizes recent error messages and never exposes prompts or digests", async () => {
    const secret = "xai-secret-token-abcdefghij"
    await insertGenerationAttempt({
      status: "failed",
      errorStage: "image_generation",
      errorMessage: `provider rejected request with Bearer ${secret}`,
    })

    const errors = await collectRecentGenerationErrors({ client })

    assert.equal(errors.length, 1)
    assert.match(errors[0]?.message ?? "", /\[redacted\]/)
    assert.doesNotMatch(JSON.stringify(errors), new RegExp(secret))
    // The view must not surface prompt text or image digests.
    assert.doesNotMatch(JSON.stringify(errors), /secret prompt text/)
    assert.equal("promptText" in (errors[0] ?? {}), false)
    assert.equal("imageSha256" in (errors[0] ?? {}), false)
  })

  test("assembles counts, recent errors, storage, and a generated timestamp", async () => {
    await insertReadyCard("only-ready")
    await insertGenerationAttempt({
      status: "failed",
      errorStage: "image_generation",
      errorMessage: "assembled failure",
      updatedAt: new Date("2026-06-15T03:00:00.000Z"),
    })

    const status = await collectOperationalStatus({
      client,
      now: () => new Date("2026-06-15T12:34:56.000Z"),
      storage: {
        resolveDatabasePath: () => "/data/juhua.sqlite",
        resolveIllustrationRoot: () => "/data/generated-illustrations",
        statBytes: async () => 2048,
        listIllustrationFiles: async () => [],
      },
    })

    assert.deepEqual(status.counts, { ready: 1, failed: 1, inProgress: 0 })
    assert.equal(status.recentErrors.length, 1)
    assert.equal(status.recentErrors[0]?.message, "assembled failure")
    assert.equal(status.storage.database.exists, true)
    assert.equal(status.storage.generatedIllustrations.fileCount, 0)
    assert.equal(status.generatedAt, "2026-06-15T12:34:56.000Z")
  })
})

describe("storage indicators", () => {
  test("reports database size and counts only valid generated illustration files", async () => {
    const validWebp = "11111111-1111-4111-8111-111111111111.webp"
    const anotherWebp = "22222222-2222-4222-8222-222222222222.webp"

    const storage = await collectStorageIndicators({
      resolveDatabasePath: () => "/data/juhua.sqlite",
      resolveIllustrationRoot: () => "/data/generated-illustrations",
      statBytes: async (path) => {
        if (path === "/data/juhua.sqlite") return 4096
        if (path.endsWith(validWebp)) return 100
        if (path.endsWith(anotherWebp)) return 250
        return null
      },
      listIllustrationFiles: async () => [
        validWebp,
        anotherWebp,
        "not-a-valid-name.webp",
        "ignored.txt",
      ],
    })

    assert.deepEqual(storage.database, {
      kind: "database",
      exists: true,
      byteLength: 4096,
    })
    assert.deepEqual(storage.generatedIllustrations, {
      kind: "generated_illustrations",
      exists: true,
      fileCount: 2,
      byteLength: 350,
    })

    // Absolute filesystem paths must never appear in the operator payload.
    assert.doesNotMatch(JSON.stringify(storage), /\/data\//)
  })

  test("reports non-existence when the database file and illustration directory are missing", async () => {
    const storage = await collectStorageIndicators({
      resolveDatabasePath: () => "/data/juhua.sqlite",
      resolveIllustrationRoot: () => "/data/generated-illustrations",
      statBytes: async () => null,
      listIllustrationFiles: async () => null,
    })

    assert.deepEqual(storage.database, {
      kind: "database",
      exists: false,
      byteLength: 0,
    })
    assert.deepEqual(storage.generatedIllustrations, {
      kind: "generated_illustrations",
      exists: false,
      fileCount: 0,
      byteLength: 0,
    })
  })
})

describe("admin status contract guards", () => {
  const validStatus = {
    counts: { ready: 1, failed: 0, inProgress: 0 },
    recentErrors: [],
    storage: {
      database: { kind: "database", exists: true, byteLength: 1 },
      generatedIllustrations: {
        kind: "generated_illustrations",
        exists: true,
        fileCount: 0,
        byteLength: 0,
      },
    },
    generatedAt: "2026-06-15T12:34:56.000Z",
  }

  test("narrows a well-formed success payload", () => {
    assert.equal(isAdminStatusResponse({ status: validStatus }), true)
    assert.equal(isAdminStatusResponse({ status: { counts: {} } }), false)
    assert.equal(isAdminStatusResponse(null), false)
    assert.equal(isAdminStatusResponse({ error: "x" }), false)
  })

  test("narrows the unauthorized payload", () => {
    assert.equal(
      isAdminStatusUnauthorizedResponse({
        error: "admin_status_unauthorized",
        message: "需要有效的访问令牌。",
      }),
      true
    )
    assert.equal(
      isAdminStatusUnauthorizedResponse({ error: "other", message: "x" }),
      false
    )
    assert.equal(isAdminStatusUnauthorizedResponse({ status: validStatus }), false)
  })
})

describe("GET /api/admin/status", () => {
  let previousAdminToken: string | undefined

  beforeEach(async () => {
    previousAdminToken = process.env.JUHUA_ADMIN_STATUS_TOKEN
    await withMigratedDatabase()
  })

  afterEach(() => {
    teardownDatabase()
    if (previousAdminToken === undefined) {
      delete process.env.JUHUA_ADMIN_STATUS_TOKEN
    } else {
      process.env.JUHUA_ADMIN_STATUS_TOKEN = previousAdminToken
    }
  })

  test("rejects unauthenticated requests with 401 and no operational data", async () => {
    process.env.JUHUA_ADMIN_STATUS_TOKEN = "owner-secret"
    await insertReadyCard("guarded")

    const response = await adminStatusRoute(
      new Request("https://example.test/api/admin/status")
    )

    assert.equal(response.status, 401)
    assert.equal(response.headers.get("www-authenticate"), "Bearer")

    const body: unknown = await response.json()
    assert.equal(isAdminStatusUnauthorizedResponse(body), true)
    assert.equal(isAdminStatusResponse(body), false)
    // The denial body must not leak any operational facts.
    assert.doesNotMatch(JSON.stringify(body), /ready|counts|storage|generatedAt/)
  })

  test("rejects access when no admin token is configured at all", async () => {
    delete process.env.JUHUA_ADMIN_STATUS_TOKEN

    const response = await adminStatusRoute(
      new Request("https://example.test/api/admin/status", {
        headers: { authorization: "Bearer anything" },
      })
    )

    assert.equal(response.status, 401)
  })

  test("returns operational status for an authenticated request", async () => {
    process.env.JUHUA_ADMIN_STATUS_TOKEN = "owner-secret"
    await insertReadyCard("served-1")
    await insertReadyCard("served-2")
    await insertGenerationAttempt({
      status: "failed",
      errorStage: "image_generation",
      errorMessage: "served failure",
    })
    await insertGenerationAttempt({ status: "started" })

    const response = await adminStatusRoute(
      new Request("https://example.test/api/admin/status", {
        headers: { authorization: "Bearer owner-secret" },
      })
    )

    assert.equal(response.status, 200)
    const body: unknown = await response.json()
    assert.equal(isAdminStatusResponse(body), true)
    if (!isAdminStatusResponse(body)) return

    assert.deepEqual(body.status.counts, { ready: 2, failed: 1, inProgress: 1 })
    assert.equal(body.status.recentErrors.length, 1)
    assert.equal(body.status.recentErrors[0]?.message, "served failure")
  })

  test("authorizes via the token query parameter as well", async () => {
    process.env.JUHUA_ADMIN_STATUS_TOKEN = "owner-secret"

    const response = await adminStatusRoute(
      new Request("https://example.test/api/admin/status?token=owner-secret")
    )

    assert.equal(response.status, 200)
  })
})
