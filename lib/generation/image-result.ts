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

function normalizeSupportedMimeType(value: string | null) {
  if (typeof value !== "string") return null

  const normalized = value.trim().toLowerCase()
  return supportedImageMimeTypes.has(normalized) ? normalized : null
}

function hasPngSignature(bytes: Buffer) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
}

function hasJpegSignature(bytes: Buffer) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  )
}

function hasWebpSignature(bytes: Buffer) {
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).equals(Buffer.from("RIFF", "ascii")) &&
    bytes.subarray(8, 12).equals(Buffer.from("WEBP", "ascii"))
  )
}

function detectSupportedImageMimeType(bytes: Buffer) {
  if (hasPngSignature(bytes)) return "image/png"
  if (hasJpegSignature(bytes)) return "image/jpeg"
  if (hasWebpSignature(bytes)) return "image/webp"
  return null
}

function resolveImageMimeType(input: {
  bytes: Buffer
  providerMimeType: string | null
}) {
  const detectedMimeType = detectSupportedImageMimeType(input.bytes)
  if (detectedMimeType === null) {
    throw new GeneratedImageNormalizationError(
      "Generated image bytes do not match a supported image format"
    )
  }

  const providerMimeType = normalizeSupportedMimeType(input.providerMimeType)
  if (providerMimeType !== null && providerMimeType !== detectedMimeType) {
    throw new GeneratedImageNormalizationError(
      `Generated image bytes do not match ${providerMimeType}`
    )
  }

  return detectedMimeType
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

  const mimeType = resolveImageMimeType({
    bytes,
    providerMimeType: input.mimeType,
  })

  return {
    bytes,
    mimeType,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }
}
