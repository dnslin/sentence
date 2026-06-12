import { fetchAndStoreHitokotoSentence } from "./hitokoto-pipeline"
import {
  buildFallbackIllustrationPrompt,
  buildIllustrationPromptMessages,
  normalizeRewrittenIllustrationPrompt,
  xaiImageAspectRatio,
  xaiImageGenerationModel,
  xaiImageResolution,
  xaiPromptRewriteModel,
} from "./illustration-prompt"
import {
  GeneratedImageNormalizationError,
  normalizeGeneratedBase64Image,
} from "./image-result"
import {
  createGenerationAttempt,
  recordGenerationFailed,
  recordImageGenerated,
  recordPromptFallback,
  sanitizeErrorMessage,
  type GenerationAttemptErrorStage,
} from "./generation-attempt-repository"

import type { DatabaseClient } from "@/lib/db/client"
import type { HitokotoFetch } from "./hitokoto-client"
import type { NormalizedGeneratedImage } from "./image-result"

export type XaiGenerationClient = {
  rewriteIllustrationPrompt(input: {
    sentence: string
    systemPrompt: string
    userPrompt: string
  }): Promise<{ content: string | null }>
  generateBase64Image(input: {
    prompt: string
    aspectRatio: typeof xaiImageAspectRatio
    resolution: typeof xaiImageResolution
  }): Promise<{ b64Json: string | null; mimeType: string | null }>
}

type GenerationPromptResult = {
  source: "rewrite" | "fallback"
  text: string
  fallbackErrorMessage?: string
}

type GenerationFailure = {
  stage: GenerationAttemptErrorStage
  message: string
}

export type XaiIllustrationGenerationResult =
  | {
      attemptId: string
      status: "image_generated"
      sentence: {
        id: string
        text: string
      }
      prompt: GenerationPromptResult
      image: NormalizedGeneratedImage
      imageGenerationAttempts: number
    }
  | {
      attemptId: string
      status: "failed"
      sentence: {
        id: string
        text: string
      }
      prompt: GenerationPromptResult
      error: GenerationFailure
    }

async function buildPrompt(input: {
  xaiClient: XaiGenerationClient
  sentence: string
}): Promise<GenerationPromptResult> {
  const messages = buildIllustrationPromptMessages(input.sentence)

  try {
    const rewrite = await input.xaiClient.rewriteIllustrationPrompt({
      sentence: input.sentence,
      ...messages,
    })

    return {
      source: "rewrite",
      text: normalizeRewrittenIllustrationPrompt(rewrite.content),
    }
  } catch (error) {
    return {
      source: "fallback",
      text: buildFallbackIllustrationPrompt(input.sentence),
      fallbackErrorMessage: sanitizeErrorMessage(toErrorMessage(error)),
    }
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown generation error"
}

type ImageGenerationRetryResult =
  | {
      status: "success"
      image: NormalizedGeneratedImage
      attempts: number
    }
  | {
      status: "failed"
      failure: GenerationFailure
      attempts: number
    }

async function generateImageWithRetry(input: {
  xaiClient: XaiGenerationClient
  promptText: string
}): Promise<ImageGenerationRetryResult> {
  let lastFailure: GenerationFailure | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const imageResponse = await input.xaiClient.generateBase64Image({
        prompt: input.promptText,
        aspectRatio: xaiImageAspectRatio,
        resolution: xaiImageResolution,
      })

      return {
        status: "success",
        image: normalizeGeneratedBase64Image(imageResponse),
        attempts: attempt,
      }
    } catch (error) {
      lastFailure = {
        stage:
          error instanceof GeneratedImageNormalizationError
            ? "image_validation"
            : "image_generation",
        message: sanitizeErrorMessage(toErrorMessage(error)),
      }
    }
  }

  return {
    status: "failed",
    failure: lastFailure ?? {
      stage: "image_generation",
      message: "Unknown generation error",
    },
    attempts: 2,
  }
}

export async function generateXaiIllustrationForHitokotoSentence(input: {
  client: DatabaseClient
  fetchFn?: HitokotoFetch
  xaiClient: XaiGenerationClient
}): Promise<XaiIllustrationGenerationResult> {
  const sentence = await fetchAndStoreHitokotoSentence({
    client: input.client,
    fetchFn: input.fetchFn,
  })

  const prompt = await buildPrompt({
    xaiClient: input.xaiClient,
    sentence: sentence.sentenceText,
  })
  const attempt = await createGenerationAttempt({
    client: input.client,
    sentenceId: sentence.sentenceId,
    promptModel: xaiPromptRewriteModel,
    imageModel: xaiImageGenerationModel,
    promptText: prompt.text,
    promptSource: prompt.source,
  })

  if (prompt.source === "fallback") {
    await recordPromptFallback({
      client: input.client,
      attemptId: attempt.id,
      promptText: prompt.text,
      errorMessage:
        prompt.fallbackErrorMessage ?? "Prompt rewrite returned unusable content",
    })
  }

  const imageResult = await generateImageWithRetry({
    xaiClient: input.xaiClient,
    promptText: prompt.text,
  })

  if (imageResult.status === "failed") {
    await recordGenerationFailed({
      client: input.client,
      attemptId: attempt.id,
      errorStage: imageResult.failure.stage,
      errorMessage: imageResult.failure.message,
      imageGenerationAttempts: imageResult.attempts,
    })

    return {
      attemptId: attempt.id,
      status: "failed",
      sentence: {
        id: sentence.sentenceId,
        text: sentence.sentenceText,
      },
      prompt,
      error: imageResult.failure,
    }
  }

  await recordImageGenerated({
    client: input.client,
    attemptId: attempt.id,
    imageMimeType: imageResult.image.mimeType,
    imageByteLength: imageResult.image.byteLength,
    imageSha256: imageResult.image.sha256,
    imageGenerationAttempts: imageResult.attempts,
    preservePromptFallbackError: prompt.source === "fallback",
  })

  return {
    attemptId: attempt.id,
    status: "image_generated",
    sentence: {
      id: sentence.sentenceId,
      text: sentence.sentenceText,
    },
    prompt,
    image: imageResult.image,
    imageGenerationAttempts: imageResult.attempts,
  }
}

export { buildFallbackIllustrationPrompt }
