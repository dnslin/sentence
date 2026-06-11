import { NextResponse } from "next/server"

import {
  anonymousCookieName,
  isValidAnonymousId,
} from "@/lib/cards/anonymous-ready-card-identity"

import type { NextRequest } from "next/server"

function buildCookieHeader(
  existingCookieHeader: string | null,
  anonymousId: string
) {
  const existingCookies = existingCookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .filter(
      (cookie) =>
        cookie.length > 0 && !cookie.startsWith(`${anonymousCookieName}=`)
    )

  return [...(existingCookies ?? []), `${anonymousCookieName}=${anonymousId}`].join(
    "; "
  )
}

function shouldUseSecureCookie(request: NextRequest) {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()

  return request.nextUrl.protocol === "https:" || forwardedProto === "https"
}

export function proxy(request: NextRequest) {
  const currentAnonymousId = request.cookies.get(anonymousCookieName)?.value

  if (currentAnonymousId && isValidAnonymousId(currentAnonymousId)) {
    return NextResponse.next()
  }

  const anonymousId = crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(
    "cookie",
    buildCookieHeader(request.headers.get("cookie"), anonymousId)
  )

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.cookies.set({
    name: anonymousCookieName,
    value: anonymousId,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
  })

  return response
}

export const config = {
  matcher: ["/", "/api/ready-card"],
}
