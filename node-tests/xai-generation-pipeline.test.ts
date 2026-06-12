import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { eq } from "drizzle-orm"

import { createDatabaseClient } from "@/lib/db/client"
import { generationAttempts } from "@/lib/db/schema"
import { buildXaiImageGenerateRequest } from "@/lib/generation/xai-client"
import {
  loadXaiConfig,
  XaiConfigurationError,
} from "@/lib/generation/xai-config"
import { buildSafeSmokeSummary } from "@/lib/generation/xai-smoke-output"
import { normalizeGeneratedBase64Image } from "@/lib/generation/image-result"
import { sanitizeErrorMessage } from "@/lib/generation/generation-attempt-repository"
import {
  buildFallbackIllustrationPrompt,
  generateXaiIllustrationForHitokotoSentence,
  type XaiGenerationClient,
} from "@/lib/generation/xai-generation-pipeline"

import type { HitokotoFetch } from "@/lib/generation/hitokoto-client"
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
let previousXaiApiKey: string | undefined
let tempDir: string
let client: DatabaseClient
let migrationImportSequence = 0

function createControlledFetch(responseBody: unknown) {
  return (async () => ({
    ok: true,
    status: 200,
    async json() {
      return responseBody
    },
  })) satisfies HitokotoFetch
}

function createImageBase64(value: string) {
  return Buffer.from(value).toString("base64")
}

async function readAttempt(attemptId: string) {
  const rows = await client.db
    .select()
    .from(generationAttempts)
    .where(eq(generationAttempts.id, attemptId))

  assert.equal(rows.length, 1)
  return rows[0]
}

beforeEach(async () => {
  previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  previousXaiApiKey = process.env.XAI_API_KEY
  tempDir = mkdtempSync(join(tmpdir(), "juhua-xai-"))
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

  if (previousXaiApiKey === undefined) {
    delete process.env.XAI_API_KEY
  } else {
    process.env.XAI_API_KEY = previousXaiApiKey
  }

  rmSync(tempDir, { recursive: true, force: true })
})

describe("xAI illustration generation pipeline", () => {
  test("rewrites a stored Hitokoto sentence, generates one 1K square base64 image, and records non-ready metadata", async () => {
    const rewrittenPrompt =
      "A small figure pauses beside a quiet riverside market at dusk, gentle watercolor picture-book feeling, low saturation, generous whitespace."
    const imageBytes = Buffer.from("controlled image bytes")
    const imageBase64 = imageBytes.toString("base64")
    const imageSha256 = createHash("sha256").update(imageBytes).digest("hex")
    const rewriteInputs: Array<
      Parameters<XaiGenerationClient["rewriteIllustrationPrompt"]>[0]
    > = []
    const imageInputs: Array<
      Parameters<XaiGenerationClient["generateBase64Image"]>[0]
    > = []
    const xaiClient: XaiGenerationClient = {
      async rewriteIllustrationPrompt(input) {
        rewriteInputs.push(input)
        return { content: rewrittenPrompt }
      },
      async generateBase64Image(input) {
        imageInputs.push(input)
        return { b64Json: imageBase64, mimeType: "image/png" }
      },
    }

    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
      xaiClient,
    })

    assert.equal(result.status, "image_generated")
    assert.equal(result.sentence.text, baseHitokotoResponse.hitokoto)
    assert.equal(result.prompt.source, "rewrite")
    assert.equal(result.prompt.text, rewrittenPrompt)
    assert.equal(result.image.mimeType, "image/png")
    assert.equal(result.image.byteLength, imageBytes.length)
    assert.equal(result.image.sha256, imageSha256)
    assert.deepEqual(result.image.bytes, imageBytes)

    assert.equal(rewriteInputs.length, 1)
    assert.equal(rewriteInputs[0]?.sentence, baseHitokotoResponse.hitokoto)
    assert.match(rewriteInputs[0]?.systemPrompt ?? "", /非署名绘本风/)
    assert.match(rewriteInputs[0]?.userPrompt ?? "", /随机短句/)

    assert.deepEqual(imageInputs, [
      {
        prompt: rewrittenPrompt,
        aspectRatio: "1:1",
        resolution: "1k",
      },
    ])

    const row = await readAttempt(result.attemptId)
    assert.equal(row?.status, "image_generated")
    assert.equal(row?.promptModel, "grok-4.3")
    assert.equal(row?.imageModel, "grok-imagine-image-quality")
    assert.equal(row?.promptText, rewrittenPrompt)
    assert.equal(row?.promptSource, "rewrite")
    assert.equal(row?.imageMimeType, "image/png")
    assert.equal(row?.imageByteLength, imageBytes.length)
    assert.equal(row?.imageSha256, imageSha256)
    assert.equal(row?.imageGenerationAttempts, 1)
    assert.equal(row?.errorStage, null)
    assert.equal(row?.errorMessage, null)
  })

  test("falls back to a deterministic prompt when prompt rewriting is unusable", async () => {
    const imageBase64 = createImageBase64("fallback image bytes")
    const prompts: string[] = []
    const xaiClient: XaiGenerationClient = {
      async rewriteIllustrationPrompt() {
        return { content: "   " }
      },
      async generateBase64Image(input) {
        prompts.push(input.prompt)
        return { b64Json: imageBase64, mimeType: "image/webp" }
      },
    }

    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
      xaiClient,
    })

    const fallbackPrompt = buildFallbackIllustrationPrompt(
      baseHitokotoResponse.hitokoto
    )
    assert.equal(result.prompt.source, "fallback")
    assert.equal(result.prompt.text, fallbackPrompt)
    assert.deepEqual(prompts, [fallbackPrompt])

    const row = await readAttempt(result.attemptId)
    assert.equal(row?.status, "image_generated")
    assert.equal(row?.promptSource, "fallback")
    assert.equal(row?.promptText, fallbackPrompt)
    assert.equal(row?.imageGenerationAttempts, 1)
    assert.equal(row?.errorStage, null)
    assert.equal(row?.errorMessage, null)
  })

  test("retries image generation once when the first image request fails", async () => {
    let imageCalls = 0
    const imageBase64 = createImageBase64("retry image bytes")
    const xaiClient: XaiGenerationClient = {
      async rewriteIllustrationPrompt() {
        return { content: "A quiet watercolor scene." }
      },
      async generateBase64Image() {
        imageCalls += 1
        if (imageCalls === 1) {
          throw new Error("temporary provider outage with token secret-value")
        }
        return { b64Json: imageBase64, mimeType: "image/png" }
      },
    }

    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
      xaiClient,
    })

    assert.equal(result.status, "image_generated")
    assert.equal(imageCalls, 2)
    const row = await readAttempt(result.attemptId)
    assert.equal(row?.status, "image_generated")
    assert.equal(row?.imageGenerationAttempts, 2)
    assert.equal(row?.errorStage, null)
    assert.equal(row?.errorMessage, null)
  })

  test("retries invalid base64 image output once before succeeding", async () => {
    let imageCalls = 0
    const imageBase64 = createImageBase64("valid retry bytes")
    const xaiClient: XaiGenerationClient = {
      async rewriteIllustrationPrompt() {
        return { content: "A quiet watercolor scene." }
      },
      async generateBase64Image() {
        imageCalls += 1
        if (imageCalls === 1) return { b64Json: "not base64", mimeType: null }
        return { b64Json: imageBase64, mimeType: null }
      },
    }

    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
      xaiClient,
    })

    assert.equal(result.status, "image_generated")
    assert.equal(result.image.mimeType, "image/png")
    assert.equal(imageCalls, 2)
    const row = await readAttempt(result.attemptId)
    assert.equal(row?.imageGenerationAttempts, 2)
    assert.equal(row?.errorStage, null)
  })

  test("records failed state when generated base64 stays invalid after retry", async () => {
    const xaiClient: XaiGenerationClient = {
      async rewriteIllustrationPrompt() {
        return { content: "A quiet watercolor scene." }
      },
      async generateBase64Image() {
        return { b64Json: "", mimeType: "image/png" }
      },
    }

    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
      xaiClient,
    })

    assert.equal(result.status, "failed")
    assert.equal(result.error.stage, "image_validation")
    assert.match(result.error.message, /base64/i)
    const row = await readAttempt(result.attemptId)
    assert.equal(row?.status, "failed")
    assert.equal(row?.imageGenerationAttempts, 2)
    assert.equal(row?.imageMimeType, null)
    assert.equal(row?.imageByteLength, null)
    assert.equal(row?.imageSha256, null)
    assert.equal(row?.errorStage, "image_validation")
    assert.match(row?.errorMessage ?? "", /base64/i)
  })

  test("records failed state when image generation fails twice", async () => {
    const xaiClient: XaiGenerationClient = {
      async rewriteIllustrationPrompt() {
        return { content: "A quiet watercolor scene." }
      },
      async generateBase64Image() {
        throw new Error("provider quota unavailable")
      },
    }

    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      fetchFn: createControlledFetch(baseHitokotoResponse),
      xaiClient,
    })

    assert.equal(result.status, "failed")
    assert.equal(result.error.stage, "image_generation")
    assert.match(result.error.message, /provider quota unavailable/)
    const row = await readAttempt(result.attemptId)
    assert.equal(row?.status, "failed")
    assert.equal(row?.imageGenerationAttempts, 2)
    assert.equal(row?.errorStage, "image_generation")
    assert.equal(row?.imageMimeType, null)
    assert.equal(row?.imageByteLength, null)
    assert.equal(row?.imageSha256, null)
  })
})

describe("xAI configuration and smoke safety", () => {
  test("builds xAI image requests with documented top-level base64 square parameters", () => {
    const request = buildXaiImageGenerateRequest({
      prompt: "A quiet watercolor scene.",
      aspectRatio: "1:1",
      resolution: "1k",
    })

    assert.deepEqual(request, {
      model: "grok-imagine-image-quality",
      prompt: "A quiet watercolor scene.",
      response_format: "b64_json",
      n: 1,
      aspect_ratio: "1:1",
      resolution: "1k",
    })
    assert.equal("extra_body" in request, false)
  })

  test("fails clearly before SDK construction when XAI_API_KEY is missing", () => {
    delete process.env.XAI_API_KEY
    let constructed = false

    assert.throws(
      () =>
        loadXaiConfig({
          createClient: () => {
            constructed = true
            return {}
          },
        }),
      XaiConfigurationError
    )
    assert.equal(constructed, false)
  })

  test("accepts valid base64 image output without padding", () => {
    const image = normalizeGeneratedBase64Image({
      b64Json: "YQ",
      mimeType: "image/png",
    })

    assert.deepEqual(image.bytes, Buffer.from("a"))
    assert.equal(image.byteLength, 1)
  })

  test("redacts configured and secret-shaped tokens from persisted errors", () => {
    process.env.XAI_API_KEY = "xai-real-secret-token"

    const message = sanitizeErrorMessage(
      "provider rejected Bearer xai-real-secret-token and sk-testsecret12345"
    )

    assert.doesNotMatch(message, /xai-real-secret-token/)
    assert.doesNotMatch(message, /sk-testsecret12345/)
    assert.match(message, /\[redacted\]/)
  })

  test("builds smoke output without secrets or raw base64 payloads", () => {
    const lines = buildSafeSmokeSummary({
      attemptId: "attempt-1",
      sentenceId: "sentence-1",
      status: "image_generated",
      promptSource: "rewrite",
      imageMimeType: "image/png",
      imageByteLength: 20,
      imageSha256: "a".repeat(64),
      artifactPath: "test-results/xai-smoke/attempt-1.png",
    })

    const text = lines.join("\n")
    assert.match(text, /XAI_API_KEY is required/)
    assert.match(text, /attempt-1/)
    assert.match(text, /digest_sha256=a{64}/)
    assert.doesNotMatch(text, /secret/i)
    assert.doesNotMatch(text, /b64/i)
    assert.doesNotMatch(text, /base64/i)
  })
})
