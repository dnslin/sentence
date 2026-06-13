import { runImmediateTransaction, type DatabaseClient } from "@/lib/db/client"
import {
  checkAndConsumeRateLimitInTransaction,
  type RateLimitResult,
} from "@/lib/rate-limit/action-rate-limit"

import { getNextReadyCardForVisitorInTransaction } from "./ready-card-repository"
import type { PublicReadyCard } from "./public-ready-card"
import type { ReadyCardRequestContext } from "./ready-card-request-context"

export type RateLimitedReadyCardResult =
  | { status: "allowed"; card: PublicReadyCard | null }
  | { status: "limited"; limit: Extract<RateLimitResult, { allowed: false }> }

export async function getRateLimitedNextReadyCardForVisitor({
  client,
  context,
  now = () => new Date(),
}: {
  client: DatabaseClient
  context: ReadyCardRequestContext
  now?: () => Date
}): Promise<RateLimitedReadyCardResult> {
  return runImmediateTransaction(client, async () => {
    const limit = await checkAndConsumeRateLimitInTransaction({
      client,
      action: "refresh",
      contextKey: context.requestContextKey,
      currentTime: now(),
    })

    if (!limit.allowed) return { status: "limited", limit }

    const card = await getNextReadyCardForVisitorInTransaction(client, context)

    return { status: "allowed", card }
  })
}
