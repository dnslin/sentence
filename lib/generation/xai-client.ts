import OpenAI from "openai"

import { loadXaiConfig } from "./xai-config"
import {
  buildIllustrationPromptMessages,
  xaiImageAspectRatio,
  xaiImageGenerationModel,
  xaiImageResolution,
  xaiPromptRewriteModel,
} from "./illustration-prompt"

import type { XaiGenerationClient } from "./xai-generation-pipeline"
import type { ImageGenerateParamsNonStreaming } from "openai/resources/images"

type OpenAIImageData = {
  b64_json?: unknown
  mime_type?: unknown
}

type XaiImageGenerateRequest = ImageGenerateParamsNonStreaming & {
  model: typeof xaiImageGenerationModel
  response_format: "b64_json"
  n: 1
  aspect_ratio: typeof xaiImageAspectRatio
  resolution: typeof xaiImageResolution
}

function normalizeSdkString(value: unknown) {
  return typeof value === "string" ? value : null
}

function getFirstImageData(value: unknown): OpenAIImageData | null {
  if (typeof value !== "object" || value === null) return null
  const data = (value as { data?: unknown }).data
  if (!Array.isArray(data)) return null
  const first = data[0]
  if (typeof first !== "object" || first === null) return null
  return first as OpenAIImageData
}

export function buildXaiImageGenerateRequest(input: {
  prompt: string
  aspectRatio: typeof xaiImageAspectRatio
  resolution: typeof xaiImageResolution
}): XaiImageGenerateRequest {
  return {
    model: xaiImageGenerationModel,
    prompt: input.prompt,
    response_format: "b64_json",
    n: 1,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
  }
}

export function createProductionXaiClient(): XaiGenerationClient {
  const sdk = loadXaiConfig<OpenAI>({
    createClient: (config) =>
      new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: 120_000,
      }),
  })

  return {
    async rewriteIllustrationPrompt(input) {
      const messages = buildIllustrationPromptMessages(input.sentence)
      const response = await sdk.chat.completions.create({
        model: xaiPromptRewriteModel,
        messages: [
          {
            role: "system",
            content: input.systemPrompt || messages.systemPrompt,
          },
          { role: "user", content: input.userPrompt || messages.userPrompt },
        ],
      })

      return {
        content: response.choices[0]?.message.content ?? null,
      }
    },

    async generateBase64Image(input) {
      const response = await sdk.images.generate(
        buildXaiImageGenerateRequest({
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          resolution: input.resolution,
        })
      )
      const firstImage = getFirstImageData(response)

      return {
        b64Json: normalizeSdkString(firstImage?.b64_json),
        mimeType: normalizeSdkString(firstImage?.mime_type),
      }
    },
  }
}
