import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

import { createReadyCardRequestContext } from "@/lib/cards/ready-card-request-context"
import { getRateLimitedNextReadyCardForVisitor } from "@/lib/cards/rate-limited-ready-card"
import { createDatabaseClient } from "@/lib/db/client"

import type {
  ReadyCardErrorResponse,
  ReadyCardLimitErrorResponse,
  ReadyCardResponse,
} from "@/lib/cards/public-ready-card"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const client = createDatabaseClient()

  try {
    const context = createReadyCardRequestContext({
      cookiesList: await cookies(),
      headersList: await headers(),
    })
    const result = await getRateLimitedNextReadyCardForVisitor({
      client,
      context,
    })

    if (result.status === "limited") {
      return NextResponse.json<ReadyCardLimitErrorResponse>(
        {
          error: "ready_card_limited",
          message: "刷新生成有点频繁了，先让当前图文卡片停留一会儿。",
        },
        {
          status: 429,
          headers: { "Retry-After": String(result.limit.retryAfterSeconds) },
        }
      )
    }

    if (!result.card) {
      return NextResponse.json<ReadyCardErrorResponse>(
        {
          error: "ready_card_not_found",
          message:
            "这会儿还没有准备好的图文卡片。新的图文绑定还在慢慢准备中，请稍后再试。",
        },
        { status: 404 }
      )
    }

    return NextResponse.json<ReadyCardResponse>({ card: result.card })
  } finally {
    client.sqlite.close()
  }
}
