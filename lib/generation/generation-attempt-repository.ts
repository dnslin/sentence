import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"

import { generationAttempts } from "@/lib/db/schema"

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
}) {
  await input.client.db
    .update(generationAttempts)
    .set({
      status: "image_generated",
      imageMimeType: input.imageMimeType,
      imageByteLength: input.imageByteLength,
      imageSha256: input.imageSha256,
      errorStage: null,
      errorMessage: null,
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

function redactKnownSecretValues(message: string) {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) return message

  return message.split(apiKey).join("[redacted]")
}

function redactSecretLikeTokens(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:xai|sk)-[A-Za-z0-9_-]{8,}\b/gi, "[redacted]")
}

export function sanitizeErrorMessage(message: string) {
  const singleLine = redactSecretLikeTokens(redactKnownSecretValues(message))
    .replace(/\s+/g, " ")
    .trim()
  if (singleLine.length === 0) return "Unknown generation error"

  return singleLine.length > 240 ? singleLine.slice(0, 240).trim() : singleLine
}
