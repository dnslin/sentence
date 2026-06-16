import { mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"

import { createDatabaseClient } from "@/lib/db/client"

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env"
) as typeof import("@next/env")

loadEnvConfig(process.cwd())
import {
  recordGenerationFailed,
  sanitizeErrorMessage,
} from "@/lib/generation/generation-attempt-repository"
import {
  XaiConfigurationError,
  loadXaiConfig,
} from "@/lib/generation/xai-config"
import { createProductionXaiClient } from "@/lib/generation/xai-client"
import { generateXaiIllustrationForHitokotoSentence } from "@/lib/generation/xai-generation-pipeline"
import { getSmokeArtifactExtension } from "@/lib/generation/xai-smoke-artifact"
import { buildSafeSmokeSummary } from "@/lib/generation/xai-smoke-output"

async function writeSmokeArtifact(input: {
  attemptId: string
  mimeType: string
  bytes: Buffer
}) {
  const extension = getSmokeArtifactExtension(input.mimeType)
  const directory = join(process.cwd(), "test-results", "xai-smoke")
  const artifactPath = join(directory, `${input.attemptId}.${extension}`)
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await mkdir(directory, { recursive: true })
      await writeFile(artifactPath, input.bytes)
      return artifactPath
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to write smoke artifact")
}

async function main() {
  let xaiConfig: ReturnType<typeof loadXaiConfig>
  try {
    xaiConfig = loadXaiConfig()
  } catch (error) {
    if (error instanceof XaiConfigurationError) {
      console.error(error.message)
      console.error(
        "Example: XAI_API_KEY=<redacted> pnpm smoke:xai. The key is read server-side only and is not printed."
      )
      process.exitCode = 1
      return
    }
    throw error
  }

  console.log(
    "Running live xAI smoke path. This may make external API calls and incur provider cost."
  )

  await import("./migrate")

  const client = createDatabaseClient()
  try {
    const result = await generateXaiIllustrationForHitokotoSentence({
      client,
      xaiClient: createProductionXaiClient(xaiConfig),
    })

    if (result.status === "failed") {
      console.log(
        buildSafeSmokeSummary({
          attemptId: result.attemptId,
          sentenceId: result.sentence.id,
          status: result.status,
          promptSource: result.prompt.source,
          errorStage: result.error.stage,
          errorMessage: result.error.message,
        }).join("\n")
      )
      process.exitCode = 1
      return
    }

    try {
      const artifactPath = await writeSmokeArtifact({
        attemptId: result.attemptId,
        mimeType: result.image.mimeType,
        bytes: result.image.bytes,
      })
      console.log(
        buildSafeSmokeSummary({
          attemptId: result.attemptId,
          sentenceId: result.sentence.id,
          status: result.status,
          promptSource: result.prompt.source,
          imageMimeType: result.image.mimeType,
          imageByteLength: result.image.byteLength,
          imageSha256: result.image.sha256,
          artifactPath,
        }).join("\n")
      )
    } catch (error) {
      const message = sanitizeErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to write smoke artifact"
      )
      await recordGenerationFailed({
        client,
        attemptId: result.attemptId,
        errorStage: "smoke_write",
        errorMessage: message,
        imageGenerationAttempts: result.imageGenerationAttempts,
      })
      console.log(
        buildSafeSmokeSummary({
          attemptId: result.attemptId,
          sentenceId: result.sentence.id,
          status: "failed",
          promptSource: result.prompt.source,
          errorStage: "smoke_write",
          errorMessage: message,
        }).join("\n")
      )
      process.exitCode = 1
    }
  } finally {
    client.sqlite.close()
  }
}

await main()
