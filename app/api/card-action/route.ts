import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

import { createReadyCardRequestContext } from "@/lib/cards/ready-card-request-context"
import { createDatabaseClient } from "@/lib/db/client"
import { checkAndConsumeRateLimit } from "@/lib/rate-limit/action-rate-limit"
import {
  isCardActionRequest,
  type CardActionName,
  type CardActionInvalidResponse,
  type CardActionResponse,
  type ReadyCardLimitErrorResponse,
} from "@/lib/cards/public-ready-card"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const actionMessages = {
  download: "PNG 下载会在后续切片接入；现在先保留这张卡片的安静样子。",
  share: "分享能力会在后续切片接入；现在没有调用系统分享。",
} as const satisfies Record<CardActionName, string>

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)

  if (!isCardActionRequest(body)) {
    return NextResponse.json<CardActionInvalidResponse>(
      {
        error: "invalid_card_action",
        message: "这个操作暂时不能处理，请回到图文卡片后再试。",
      },
      { status: 400 }
    )
  }

  const client = createDatabaseClient()

  try {
    const context = createReadyCardRequestContext({
      cookiesList: await cookies(),
      headersList: await headers(),
    })
    const limit = await checkAndConsumeRateLimit({
      client,
      action: body.action,
      contextKey: context.requestContextKey,
    })

    if (!limit.allowed) {
      return NextResponse.json<ReadyCardLimitErrorResponse>(
        {
          error: "ready_card_limited",
          message: "这个操作有点频繁了，先让当前图文卡片停留一会儿。",
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      )
    }

    return NextResponse.json<CardActionResponse>({
      action: body.action,
      status: "allowed",
      message: actionMessages[body.action],
    })
  } finally {
    client.sqlite.close()
  }
}
