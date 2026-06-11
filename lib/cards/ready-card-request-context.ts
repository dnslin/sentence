import { createHash } from "node:crypto"

import {
  anonymousCookieName,
  isValidAnonymousId,
} from "./anonymous-ready-card-identity"

export { anonymousCookieName }

export type ReadyCardRequestContext = {
  visitorKey: string
  requestContextKey: string
}

type HeaderReader = {
  get(name: string): string | null
}

type CookieReader = {
  get(name: string): { value: string } | undefined
}

function normalizeIpContext(headersList: HeaderReader) {
  const forwardedFor = headersList.get("x-forwarded-for")
  const realIp = headersList.get("x-real-ip")
  const rawValue = forwardedFor?.split(",")[0] ?? realIp ?? "unknown"

  return rawValue.trim().toLowerCase() || "unknown"
}

export function createReadyCardRequestContext({
  cookiesList,
  headersList,
}: {
  cookiesList: CookieReader
  headersList: HeaderReader
}): ReadyCardRequestContext {
  const anonymousId = cookiesList.get(anonymousCookieName)?.value
  const safeAnonymousId =
    anonymousId && isValidAnonymousId(anonymousId) ? anonymousId : "missing"
  const ipContext = normalizeIpContext(headersList)
  const visitorKey = createHash("sha256").update(safeAnonymousId).digest("hex")
  const requestContextKey = createHash("sha256")
    .update(`${safeAnonymousId}:${ipContext}`)
    .digest("hex")

  return { visitorKey, requestContextKey }
}
