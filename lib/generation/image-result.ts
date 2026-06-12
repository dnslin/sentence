import { createHash } from "node:crypto"

export type NormalizedGeneratedImage = {
  bytes: Buffer
  mimeType: string
  byteLength: number
  sha256: string
}

export class GeneratedImageNormalizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeneratedImageNormalizationError"
  }
}

const supportedImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
])

function normalizeBase64Payload(value: string | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new GeneratedImageNormalizationError(
      "Generated image base64 is missing"
    )
  }

  const compact = value.trim().replace(/\s+/g, "")
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new GeneratedImageNormalizationError(
      "Generated image base64 is invalid"
    )
  }

  const paddingLength = (4 - (compact.length % 4)) % 4
  return compact.padEnd(compact.length + paddingLength, "=")
}

function normalizeMimeType(value: string | null) {
  if (typeof value !== "string") return "image/png"

  const normalized = value.trim().toLowerCase()
  return supportedImageMimeTypes.has(normalized) ? normalized : "image/png"
}

export function normalizeGeneratedBase64Image(input: {
  b64Json: string | null
  mimeType: string | null
}): NormalizedGeneratedImage {
  const compact = normalizeBase64Payload(input.b64Json)
  const bytes = Buffer.from(compact, "base64")

  if (bytes.length === 0) {
    throw new GeneratedImageNormalizationError(
      "Generated image bytes are empty"
    )
  }

  return {
    bytes,
    mimeType: normalizeMimeType(input.mimeType),
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }
}
