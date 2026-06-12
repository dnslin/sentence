import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"

import { generationAttempts } from "@/lib/db/schema"
import { sanitizeErrorMessage } from "./error-sanitizer"

import type { DatabaseClient } from "@/lib/db/client"

export type GenerationAttemptStatus =
  | "started"
  | "prompt_fallback"
  | "image_generated"
  | "failed"

export type GenerationAttemptPromptSource = "rewrite" | "fallback"

export type GenerationAttemptErrorStage =
  | "prompt_rewrite"
  | "image_generation"
  | "image_validation"
  | "smoke_write"

export type CreatedGenerationAttempt = {
  id: string
  createdAt: Date
}

export async function createGenerationAttempt(input: {
  client: DatabaseClient
  sentenceId: string
  promptModel: string
  imageModel: string
  promptText: string
  promptSource: GenerationAttemptPromptSource
}) {
  const now = new Date()
  const attempt = {
    id: randomUUID(),
    createdAt: now,
  } satisfies CreatedGenerationAttempt

  await input.client.db.insert(generationAttempts).values({
    id: attempt.id,
    sentenceId: input.sentenceId,
    status: input.promptSource === "fallback" ? "prompt_fallback" : "started",
    promptModel: input.promptModel,
    imageModel: input.imageModel,
    promptText: input.promptText,
    promptSource: input.promptSource,
    imageMimeType: null,
    imageByteLength: null,
    imageSha256: null,
    errorStage: null,
    errorMessage: null,
    imageGenerationAttempts: 0,
    createdAt: now,
    updatedAt: now,
  })

  return attempt
}

export async function recordPromptFallback(input: {
  client: DatabaseClient
  attemptId: string
  promptText: string
  errorMessage: string
}) {
  await input.client.db
    .update(generationAttempts)
    .set({
      status: "prompt_fallback",
      promptText: input.promptText,
      promptSource: "fallback",
      errorStage: "prompt_rewrite",
      errorMessage: sanitizeErrorMessage(input.errorMessage),
      updatedAt: new Date(),
    })
    .where(eq(generationAttempts.id, input.attemptId))
}

export async function recordImageGenerated(input: {
  client: DatabaseClient
  attemptId: string
  imageMimeType: string
  imageByteLength: number
  imageSha256: string
  imageGenerationAttempts: number
  preservePromptFallbackError?: boolean
}) {
  await input.client.db
    .update(generationAttempts)
    .set({
      status: "image_generated",
      imageMimeType: input.imageMimeType,
      imageByteLength: input.imageByteLength,
      imageSha256: input.imageSha256,
      errorStage: input.preservePromptFallbackError ? "prompt_rewrite" : null,
      errorMessage: input.preservePromptFallbackError ? undefined : null,
      imageGenerationAttempts: input.imageGenerationAttempts,
      updatedAt: new Date(),
    })
    .where(eq(generationAttempts.id, input.attemptId))
}

export async function recordGenerationFailed(input: {
  client: DatabaseClient
  attemptId: string
  errorStage: GenerationAttemptErrorStage
  errorMessage: string
  imageGenerationAttempts: number
}) {
  await input.client.db
    .update(generationAttempts)
    .set({
      status: "failed",
      errorStage: input.errorStage,
      errorMessage: sanitizeErrorMessage(input.errorMessage),
      imageGenerationAttempts: input.imageGenerationAttempts,
      updatedAt: new Date(),
    })
    .where(eq(generationAttempts.id, input.attemptId))
}

export { sanitizeErrorMessage }
