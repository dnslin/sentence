import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { count, eq } from "drizzle-orm"

import { hitokotoSentenceMetadata, sentences } from "@/lib/db/schema"
import { createDatabaseClient } from "@/lib/db/client"
import { fetchAndStoreHitokotoSentence } from "@/lib/generation/hitokoto-pipeline"
import {
  HitokotoNormalizationError,
  type HitokotoFetch,
} from "@/lib/generation/hitokoto-client"

import type { DatabaseClient } from "@/lib/db/client"

const baseHitokotoResponse = {
  id: 123,
  uuid: "8e393845-8c79-4f3b-9c6a-1d43d7b60e9c",
  hitokoto: "山河远阔，人间烟火",
  type: "d",
  from: "测试出处",
  from_who: null,
  creator: "tester",
  creator_uid: 456,
  reviewer: 789,
  commit_from: "web",
  created_at: "2024-01-02 03:04:05",
  length: 10,
} as const

let previousDatabasePath: string | undefined
let tempDir: string
let client: DatabaseClient
let migrationImportSequence = 0

function createControlledFetch(responseBody: unknown, seenUrls: string[] = []) {
  return (async (url: string) => {
    seenUrls.push(url)
    return {
      ok: true,
      status: 200,
      async json() {
        return responseBody
      },
    }
  }) satisfies HitokotoFetch
}

async function countRows() {
  const [sentenceCount] = await client.db
    .select({ value: count() })
    .from(sentences)
  const [metadataCount] = await client.db
    .select({ value: count() })
    .from(hitokotoSentenceMetadata)

  return {
    sentences: sentenceCount?.value ?? 0,
    metadata: metadataCount?.value ?? 0,
  }
}

beforeEach(async () => {
  previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  tempDir = mkdtempSync(join(tmpdir(), "juhua-hitokoto-"))
  process.env.JUHUA_DATABASE_PATH = join(tempDir, "juhua.sqlite")

  await import(`../scripts/migrate.ts?test=${++migrationImportSequence}`)
  client = createDatabaseClient()
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

describe("Hitokoto sentence ingestion", () => {
  test("fetches with required query parameters, normalizes, and stores metadata", async () => {
    const seenUrls: string[] = []
    const stored = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse, seenUrls),
    })

    assert.equal(seenUrls.length, 1)
    const url = new URL(seenUrls[0] ?? "")
    assert.equal(url.origin + url.pathname, "https://v1.hitokoto.cn/")
    assert.equal(url.searchParams.get("encode"), "json")
    assert.equal(url.searchParams.get("min_length"), "6")
    assert.equal(url.searchParams.get("max_length"), "30")
    assert.deepEqual(url.searchParams.getAll("c"), ["d", "e", "i", "k"])

    assert.equal(stored.inserted, true)
    assert.equal(stored.sentenceText, baseHitokotoResponse.hitokoto)
    assert.equal(stored.hitokotoUuid, baseHitokotoResponse.uuid)
    assert.equal(
      stored.sourceIdentity,
      `hitokoto:uuid:${baseHitokotoResponse.uuid}`
    )

    const rows = await client.db
      .select({
        text: sentences.text,
        source: sentences.source,
        hitokotoUuid: hitokotoSentenceMetadata.hitokotoUuid,
        fromWho: hitokotoSentenceMetadata.fromWho,
        hitokotoId: hitokotoSentenceMetadata.hitokotoId,
      })
      .from(sentences)
      .innerJoin(
        hitokotoSentenceMetadata,
        eq(hitokotoSentenceMetadata.sentenceId, sentences.id)
      )

    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.text, baseHitokotoResponse.hitokoto)
    assert.equal(rows[0]?.source, "hitokoto")
    assert.equal(rows[0]?.hitokotoUuid, baseHitokotoResponse.uuid)
    assert.equal(rows[0]?.fromWho, null)
    assert.equal(rows[0]?.hitokotoId, baseHitokotoResponse.id)
  })

  test("reuses the existing sentence for duplicate Hitokoto UUIDs", async () => {
    const first = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
    })
    const second = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch({
        ...baseHitokotoResponse,
        hitokoto: "山河远阔，人间烟火",
      }),
    })

    assert.equal(second.inserted, false)
    assert.equal(second.sentenceId, first.sentenceId)
    assert.deepEqual(await countRows(), { sentences: 1, metadata: 1 })
  })

  test("reuses the existing sentence for equivalent UUID-less identities", async () => {
    const firstResponse = {
      ...baseHitokotoResponse,
      uuid: null,
      hitokoto: "忽有故人心上过",
      type: "i",
      from: "旧梦",
      from_who: "佚名",
    }
    const secondResponse = {
      ...firstResponse,
      id: 999,
      uuid: "",
      hitokoto: " 忽有故人心上过 ",
    }

    const first = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch(firstResponse),
    })
    const second = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch(secondResponse),
    })

    assert.equal(first.hitokotoUuid, null)
    assert.equal(second.inserted, false)
    assert.equal(second.sentenceId, first.sentenceId)
    assert.deepEqual(await countRows(), { sentences: 1, metadata: 1 })
  })

  test("reuses fallback identity when Hitokoto UUID is unusable", async () => {
    const firstResponse = {
      ...baseHitokotoResponse,
      uuid: "not-a-uuid",
      hitokoto: "长风破浪会有时",
      type: "k",
      from: "行路难",
      from_who: "李白",
    }
    const secondResponse = {
      ...firstResponse,
      id: 1000,
      uuid: "also-not-a-uuid",
    }

    const first = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch(firstResponse),
    })
    const second = await fetchAndStoreHitokotoSentence({
      client,
      fetchFn: createControlledFetch(secondResponse),
    })

    assert.equal(first.hitokotoUuid, null)
    assert.equal(second.inserted, false)
    assert.equal(second.sentenceId, first.sentenceId)
    assert.deepEqual(await countRows(), { sentences: 1, metadata: 1 })
  })

  test("rejects out-of-range responses before database writes", async () => {
    await assert.rejects(
      fetchAndStoreHitokotoSentence({
        client,
        fetchFn: createControlledFetch({
          ...baseHitokotoResponse,
          hitokoto: "太短",
        }),
      }),
      HitokotoNormalizationError
    )

    assert.deepEqual(await countRows(), { sentences: 0, metadata: 0 })
  })
})
