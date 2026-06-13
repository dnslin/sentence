import { and, eq } from "drizzle-orm"

import { runImmediateTransaction, type DatabaseClient } from "@/lib/db/client"
import { rateLimitWindows } from "@/lib/db/schema"

export const rateLimitWindowMs = 60 * 60 * 1000
export const rateLimitedActions = ["refresh", "download", "share"] as const

export type RateLimitedAction = (typeof rateLimitedActions)[number]

type RateLimitConfig = {
  limit: number
  windowMs: typeof rateLimitWindowMs
}

export const rateLimitConfigs = {
  refresh: { limit: 120, windowMs: rateLimitWindowMs },
  download: { limit: 60, windowMs: rateLimitWindowMs },
  share: { limit: 60, windowMs: rateLimitWindowMs },
} as const satisfies Record<RateLimitedAction, RateLimitConfig>

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: Date }
  | { allowed: false; retryAfterSeconds: number; resetAt: Date }

export function isRateLimitedAction(
  value: unknown
): value is RateLimitedAction {
  return (
    typeof value === "string" &&
    rateLimitedActions.includes(value as RateLimitedAction)
  )
}

export function getRateLimitWindowStart(
  now: Date,
  windowMs = rateLimitWindowMs
) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

export function getRetryAfterSeconds(now: Date, resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
}

export async function checkAndConsumeRateLimit({
  client,
  action,
  contextKey,
  now = () => new Date(),
}: {
  client: DatabaseClient
  action: RateLimitedAction
  contextKey: string
  now?: () => Date
}): Promise<RateLimitResult> {
  return runImmediateTransaction(client, async () => {
    const currentTime = now()
    const config = rateLimitConfigs[action]
    const windowStart = getRateLimitWindowStart(currentTime, config.windowMs)
    const resetAt = new Date(windowStart.getTime() + config.windowMs)

    const [existing] = await client.db
      .select({ count: rateLimitWindows.count })
      .from(rateLimitWindows)
      .where(
        and(
          eq(rateLimitWindows.action, action),
          eq(rateLimitWindows.contextKey, contextKey),
          eq(rateLimitWindows.windowStart, windowStart)
        )
      )
      .limit(1)

    if (existing && existing.count >= config.limit) {
      return {
        allowed: false,
        retryAfterSeconds: getRetryAfterSeconds(currentTime, resetAt),
        resetAt,
      }
    }

    const nextCount = (existing?.count ?? 0) + 1

    if (existing) {
      await client.db
        .update(rateLimitWindows)
        .set({ count: nextCount, updatedAt: currentTime })
        .where(
          and(
            eq(rateLimitWindows.action, action),
            eq(rateLimitWindows.contextKey, contextKey),
            eq(rateLimitWindows.windowStart, windowStart)
          )
        )
    } else {
      await client.db.insert(rateLimitWindows).values({
        action,
        contextKey,
        windowStart,
        count: nextCount,
        createdAt: currentTime,
        updatedAt: currentTime,
      })
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.limit - nextCount),
      resetAt,
    }
  })
}
