import { createHash, randomUUID } from "node:crypto"
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"

import sharp from "sharp"

import { sanitizeErrorMessage } from "./error-sanitizer"

export const generatedIllustrationWebpQuality = 88
export const generatedIllustrationPublicPathPrefix = "/generated-illustrations"

const generatedIllustrationFilenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/

export class GeneratedIllustrationStorageError extends Error {
  readonly stage: "image_storage" | "image_conversion"

  constructor(stage: "image_storage" | "image_conversion", message: string) {
    super(sanitizeErrorMessage(message))
    this.name = "GeneratedIllustrationStorageError"
    this.stage = stage
  }
}

export type StoredGeneratedIllustration = {
  filename: string
  publicPath: string
  filePath: string
  byteLength: number
  sha256: string
}

export async function removeStoredGeneratedIllustration(
  illustration: Pick<StoredGeneratedIllustration, "filePath">
) {
  await rm(illustration.filePath, { force: true }).catch(() => undefined)
}

export function resolveGeneratedIllustrationRoot() {
  const configuredPath = process.env.JUHUA_GENERATED_ILLUSTRATIONS_DIR
  if (configuredPath) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(/*turbopackIgnore: true*/ configuredPath)
  }

  return join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "generated-illustrations"
  )
}

export function isValidGeneratedIllustrationFilename(filename: string) {
  return generatedIllustrationFilenamePattern.test(filename)
}

export function resolveGeneratedIllustrationFilePath(filename: string) {
  if (!isValidGeneratedIllustrationFilename(filename)) return null

  const root = resolveGeneratedIllustrationRoot()
  const filePath = resolve(/*turbopackIgnore: true*/ root, filename)
  const relativePath = relative(root, filePath)
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null
  }

  return filePath
}

export function resolveGeneratedIllustrationPublicPath(publicPath: string) {
  const prefix = `${generatedIllustrationPublicPathPrefix}/`
  if (!publicPath.startsWith(prefix)) return null
  if (publicPath.includes("://") || publicPath.startsWith("//")) return null

  const filename = publicPath.slice(prefix.length)
  if (filename.includes("/")) return null

  return isValidGeneratedIllustrationFilename(filename)
    ? `${generatedIllustrationPublicPathPrefix}/${filename}`
    : null
}

export function resolveGeneratedIllustrationFilePathFromPublicPath(
  publicPath: string
) {
  const safePublicPath = resolveGeneratedIllustrationPublicPath(publicPath)
  if (!safePublicPath) return null

  const filename = safePublicPath.slice(
    `${generatedIllustrationPublicPathPrefix}/`.length
  )
  return resolveGeneratedIllustrationFilePath(filename)
}

export async function removeStoredGeneratedIllustrationByPublicPath(
  publicPath: string
) {
  const filePath =
    resolveGeneratedIllustrationFilePathFromPublicPath(publicPath)
  if (!filePath) return

  await rm(filePath, { force: true }).catch(() => undefined)
}

async function ensureWritableDirectory(root: string) {
  await mkdir(root, { recursive: true })
  const rootStats = await stat(root)
  if (!rootStats.isDirectory()) {
    throw new Error("Generated illustration root is not a directory")
  }
}

export async function storeGeneratedIllustrationAsWebp(input: {
  imageBytes: Buffer
  filename?: string
}): Promise<StoredGeneratedIllustration> {
  const root = resolveGeneratedIllustrationRoot()
  const filename = input.filename ?? `${randomUUID()}.webp`

  if (!isValidGeneratedIllustrationFilename(filename)) {
    throw new GeneratedIllustrationStorageError(
      "image_storage",
      "Generated illustration filename is invalid"
    )
  }

  const finalPath = join(/*turbopackIgnore: true*/ root, filename)
  const temporaryPath = join(
    /*turbopackIgnore: true*/ root,
    `${filename}.${randomUUID()}.tmp`
  )

  try {
    await ensureWritableDirectory(root)
  } catch (error) {
    throw new GeneratedIllustrationStorageError(
      "image_storage",
      error instanceof Error
        ? error.message
        : "Generated illustration storage failed"
    )
  }

  let webpBytes: Buffer

  try {
    webpBytes = await sharp(input.imageBytes)
      .webp({ quality: generatedIllustrationWebpQuality })
      .toBuffer()
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw new GeneratedIllustrationStorageError(
      "image_conversion",
      error instanceof Error
        ? error.message
        : "Generated illustration conversion failed"
    )
  }

  try {
    await writeFile(temporaryPath, webpBytes, { flag: "wx" })
    await rename(temporaryPath, finalPath)
    const finalStats = await stat(finalPath)

    return {
      filename,
      publicPath: `${generatedIllustrationPublicPathPrefix}/${filename}`,
      filePath: finalPath,
      byteLength: finalStats.size,
      sha256: createHash("sha256").update(webpBytes).digest("hex"),
    }
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    await rm(finalPath, { force: true }).catch(() => undefined)
    throw new GeneratedIllustrationStorageError(
      "image_storage",
      error instanceof Error
        ? error.message
        : "Generated illustration storage failed"
    )
  }
}
