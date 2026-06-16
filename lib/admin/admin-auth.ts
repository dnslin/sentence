import { createHash, timingSafeEqual } from "node:crypto"

export const adminStatusTokenEnvKey = "JUHUA_ADMIN_STATUS_TOKEN"

export type AdminAuthDenialReason =
  | "not_configured"
  | "missing_token"
  | "invalid_token"

export type AdminAuthResult =
  | { authorized: true }
  | { authorized: false; reason: AdminAuthDenialReason }

// We only ever read string-valued keys from the environment, so accept any
// string map. `process.env` (NodeJS.ProcessEnv) is assignable to this, and
// tests can pass partial objects without forging an entire ProcessEnv.
export type AdminStatusEnv = Record<string, string | undefined>

export function resolveAdminStatusToken(
  env: AdminStatusEnv = process.env
): string | null {
  const configured = env[adminStatusTokenEnvKey]?.trim()
  return configured ? configured : null
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest()
}

// Compare in constant time. Hashing both sides to a fixed 32-byte digest keeps
// `timingSafeEqual` happy with equal-length buffers and prevents the length of
// the presented token from leaking through an early return.
function tokensMatch(presentedToken: string, configuredToken: string): boolean {
  return timingSafeEqual(digest(presentedToken), digest(configuredToken))
}

export function verifyAdminStatusToken(input: {
  presentedToken: string | null
  configuredToken: string | null
}): AdminAuthResult {
  if (input.configuredToken === null) {
    return { authorized: false, reason: "not_configured" }
  }

  const presentedToken = input.presentedToken?.trim()
  if (!presentedToken) {
    return { authorized: false, reason: "missing_token" }
  }

  return tokensMatch(presentedToken, input.configuredToken)
    ? { authorized: true }
    : { authorized: false, reason: "invalid_token" }
}

const bearerSchemePattern = /^Bearer\s+(.+)$/i

export function extractPresentedAdminToken(request: Request): string | null {
  const authorizationHeader = request.headers.get("authorization")
  if (authorizationHeader) {
    const match = bearerSchemePattern.exec(authorizationHeader.trim())
    const headerToken = match?.[1]?.trim()
    if (headerToken) return headerToken
  }

  const queryToken = new URL(request.url).searchParams.get("token")?.trim()
  return queryToken ? queryToken : null
}

export function authorizeAdminStatusRequest(input: {
  request: Request
  env?: AdminStatusEnv
}): AdminAuthResult {
  return verifyAdminStatusToken({
    presentedToken: extractPresentedAdminToken(input.request),
    configuredToken: resolveAdminStatusToken(input.env),
  })
}
