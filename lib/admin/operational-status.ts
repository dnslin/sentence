import { stat, readdir } from "node:fs/promises"
import { join } from "node:path"

import { count, desc, eq, inArray } from "drizzle-orm"

import { countPublicReadyCards } from "@/lib/cards/ready-card-repository"
import { resolveDatabasePath } from "@/lib/db/client"
import { sanitizeErrorMessage } from "@/lib/generation/error-sanitizer"
import {
  isValidGeneratedIllustrationFilename,
  resolveGeneratedIllustrationRoot,
} from "@/lib/generation/generated-illustration-storage"
import { generationAttempts } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"

export type OperationalCounts = {
  ready: number
  failed: number
  inProgress: number
}

export type RecentGenerationError = {
  attemptId: string
  stage: string | null
  message: string | null
  occurredAt: string
}

export type DatabaseStorageIndicator = {
  kind: "database"
  exists: boolean
  byteLength: number
}

export type GeneratedIllustrationsStorageIndicator = {
  kind: "generated_illustrations"
  exists: boolean
  fileCount: number
  byteLength: number
}

export type StorageIndicators = {
  database: DatabaseStorageIndicator
  generatedIllustrations: GeneratedIllustrationsStorageIndicator
}

export type OperationalStatus = {
  counts: OperationalCounts
  recentErrors: RecentGenerationError[]
  storage: StorageIndicators
  generatedAt: string
}

export const recentGenerationErrorLimit = 10

const inProgressAttemptStatuses: string[] = ["started", "prompt_fallback"]
const failedAttemptStatuses: string[] = ["failed"]

async function countAttemptsByStatus(
  client: DatabaseClient,
  statuses: string[]
): Promise<number> {
  const [row] = await client.db
    .select({ value: count() })
    .from(generationAttempts)
    .where(inArray(generationAttempts.status, statuses))

  return row?.value ?? 0
}

export async function collectOperationalCounts(
  client: DatabaseClient
): Promise<OperationalCounts> {
  const [ready, failed, inProgress] = await Promise.all([
    countPublicReadyCards(client),
    countAttemptsByStatus(client, failedAttemptStatuses),
    countAttemptsByStatus(client, inProgressAttemptStatuses),
  ])

  return { ready, failed, inProgress }
}

export async function collectRecentGenerationErrors(input: {
  client: DatabaseClient
  limit?: number
}): Promise<RecentGenerationError[]> {
  const limit = input.limit ?? recentGenerationErrorLimit

  const rows = await input.client.db
    .select({
      id: generationAttempts.id,
      errorStage: generationAttempts.errorStage,
      errorMessage: generationAttempts.errorMessage,
      updatedAt: generationAttempts.updatedAt,
    })
    .from(generationAttempts)
    .where(eq(generationAttempts.status, "failed"))
    .orderBy(desc(generationAttempts.updatedAt), desc(generationAttempts.id))
    .limit(limit)

  return rows.map((row) => ({
    attemptId: row.id,
    stage: row.errorStage,
    // Persisted messages are already sanitized; re-sanitize at this boundary as
    // defense in depth so secrets never reach an operator-facing payload.
    message: row.errorMessage ? sanitizeErrorMessage(row.errorMessage) : null,
    occurredAt: row.updatedAt.toISOString(),
  }))
}

export type StorageProbe = {
  resolveDatabasePath?: () => string
  resolveIllustrationRoot?: () => string
  // Returns byte size, or null when the path does not exist.
  statBytes?: (path: string) => Promise<number | null>
  // Returns directory entries, or null when the directory does not exist.
  listIllustrationFiles?: (root: string) => Promise<string[] | null>
}

async function defaultStatBytes(path: string): Promise<number | null> {
  try {
    const stats = await stat(path)
    return stats.isFile() ? stats.size : null
  } catch {
    return null
  }
}

async function defaultListIllustrationFiles(
  root: string
): Promise<string[] | null> {
  try {
    return await readdir(root)
  } catch {
    return null
  }
}

export async function collectStorageIndicators(
  probe: StorageProbe = {}
): Promise<StorageIndicators> {
  const databasePath = (probe.resolveDatabasePath ?? resolveDatabasePath)()
  const illustrationRoot = (
    probe.resolveIllustrationRoot ?? resolveGeneratedIllustrationRoot
  )()
  const statBytes = probe.statBytes ?? defaultStatBytes
  const listIllustrationFiles =
    probe.listIllustrationFiles ?? defaultListIllustrationFiles

  const databaseBytes = await statBytes(databasePath)
  const database: DatabaseStorageIndicator = {
    kind: "database",
    exists: databaseBytes !== null,
    byteLength: databaseBytes ?? 0,
  }

  const entries = await listIllustrationFiles(illustrationRoot)
  const generatedIllustrations: GeneratedIllustrationsStorageIndicator =
    await summarizeIllustrationDirectory({
      entries,
      illustrationRoot,
      statBytes,
    })

  return { database, generatedIllustrations }
}

async function summarizeIllustrationDirectory(input: {
  entries: string[] | null
  illustrationRoot: string
  statBytes: (path: string) => Promise<number | null>
}): Promise<GeneratedIllustrationsStorageIndicator> {
  if (input.entries === null) {
    return {
      kind: "generated_illustrations",
      exists: false,
      fileCount: 0,
      byteLength: 0,
    }
  }

  const validFilenames = input.entries.filter(
    isValidGeneratedIllustrationFilename
  )

  let byteLength = 0
  for (const filename of validFilenames) {
    const fileBytes = await input.statBytes(
      join(input.illustrationRoot, filename)
    )
    byteLength += fileBytes ?? 0
  }

  return {
    kind: "generated_illustrations",
    exists: true,
    fileCount: validFilenames.length,
    byteLength,
  }
}

export async function collectOperationalStatus(input: {
  client: DatabaseClient
  now?: () => Date
  recentErrorLimit?: number
  storage?: StorageProbe
}): Promise<OperationalStatus> {
  const now = input.now ?? (() => new Date())

  const [counts, recentErrors, storage] = await Promise.all([
    collectOperationalCounts(input.client),
    collectRecentGenerationErrors({
      client: input.client,
      limit: input.recentErrorLimit,
    }),
    collectStorageIndicators(input.storage),
  ])

  return {
    counts,
    recentErrors,
    storage,
    generatedAt: now().toISOString(),
  }
}
