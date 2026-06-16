import type {
  DatabaseStorageIndicator,
  GeneratedIllustrationsStorageIndicator,
  OperationalCounts,
  OperationalStatus,
  RecentGenerationError,
} from "./operational-status"

export const adminStatusUnauthorizedError = "admin_status_unauthorized" as const

export type AdminStatusResponse = {
  status: OperationalStatus
}

export type AdminStatusUnauthorizedResponse = {
  error: typeof adminStatusUnauthorizedError
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isOperationalCounts(value: unknown): value is OperationalCounts {
  if (!isRecord(value)) return false
  return (
    typeof value.ready === "number" &&
    typeof value.failed === "number" &&
    typeof value.inProgress === "number"
  )
}

function isRecentGenerationError(
  value: unknown
): value is RecentGenerationError {
  if (!isRecord(value)) return false
  return (
    typeof value.attemptId === "string" &&
    (typeof value.stage === "string" || value.stage === null) &&
    (typeof value.message === "string" || value.message === null) &&
    typeof value.occurredAt === "string"
  )
}

function isDatabaseStorageIndicator(
  value: unknown
): value is DatabaseStorageIndicator {
  if (!isRecord(value)) return false
  return (
    value.kind === "database" &&
    typeof value.exists === "boolean" &&
    typeof value.byteLength === "number"
  )
}

function isGeneratedIllustrationsStorageIndicator(
  value: unknown
): value is GeneratedIllustrationsStorageIndicator {
  if (!isRecord(value)) return false
  return (
    value.kind === "generated_illustrations" &&
    typeof value.exists === "boolean" &&
    typeof value.fileCount === "number" &&
    typeof value.byteLength === "number"
  )
}

function isOperationalStatus(value: unknown): value is OperationalStatus {
  if (!isRecord(value)) return false
  if (!isOperationalCounts(value.counts)) return false
  if (!Array.isArray(value.recentErrors)) return false
  if (!value.recentErrors.every(isRecentGenerationError)) return false
  if (!isRecord(value.storage)) return false
  if (!isDatabaseStorageIndicator(value.storage.database)) return false
  if (
    !isGeneratedIllustrationsStorageIndicator(
      value.storage.generatedIllustrations
    )
  ) {
    return false
  }
  return typeof value.generatedAt === "string"
}

export function isAdminStatusResponse(
  value: unknown
): value is AdminStatusResponse {
  if (!isRecord(value)) return false
  return isOperationalStatus(value.status)
}

export function isAdminStatusUnauthorizedResponse(
  value: unknown
): value is AdminStatusUnauthorizedResponse {
  if (!isRecord(value)) return false
  return (
    value.error === adminStatusUnauthorizedError &&
    typeof value.message === "string"
  )
}
