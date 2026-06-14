import { and, eq, lt } from "drizzle-orm"

import { runImmediateTransaction, type DatabaseClient } from "@/lib/db/client"
import { rateLimitWindows } from "@/lib/db/schema"

import {
  rateLimitConfigs,
  rateLimitWindowMs,
  type RateLimitedAction,
} from "./actions"

export {
  cardActionNames,
  isRateLimitedAction,
  rateLimitConfigs,
  rateLimitedActions,
  rateLimitWindowMs,
  type CardActionName,
  type RateLimitedAction,
} from "./actions"

export const rateLimitRetentionMs = 3 * 24 * rateLimitWindowMs

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: Date }
  | { allowed: false; retryAfterSeconds: number; resetAt: Date }

export function getRateLimitWindowStart(
  now: Date,
  windowMs = rateLimitWindowMs
) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

export function getRetryAfterSeconds(now: Date, resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
}

async function pruneExpiredRateLimitWindows(
  client: DatabaseClient,
  currentTime: Date
) {
  const oldestRetainedWindow = getRateLimitWindowStart(
    new Date(currentTime.getTime() - rateLimitRetentionMs)
  )

  await client.db
    .delete(rateLimitWindows)
    .where(lt(rateLimitWindows.windowStart, oldestRetainedWindow))
}

export async function checkAndConsumeRateLimitInTransaction({
  client,
  action,
  contextKey,
  currentTime,
}: {
  client: DatabaseClient
  action: RateLimitedAction
  contextKey: string
  currentTime: Date
}): Promise<RateLimitResult> {
  const config = rateLimitConfigs[action]
  const windowStart = getRateLimitWindowStart(currentTime, config.windowMs)
  const resetAt = new Date(windowStart.getTime() + config.windowMs)

  await pruneExpiredRateLimitWindows(client, currentTime)

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
  return runImmediateTransaction(client, () =>
    checkAndConsumeRateLimitInTransaction({
      client,
      action,
      contextKey,
      currentTime: now(),
    })
  )
}
