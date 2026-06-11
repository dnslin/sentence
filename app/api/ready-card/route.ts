import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

import { createReadyCardRequestContext } from "@/lib/cards/ready-card-request-context"
import { getNextReadyCardForVisitor } from "@/lib/cards/ready-card-repository"
import { createDatabaseClient } from "@/lib/db/client"

import type { ReadyCardResponse } from "@/lib/cards/public-ready-card"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReadyCardErrorResponse = {
  error: "ready_card_not_found"
  message: string
}

export async function GET() {
  const client = createDatabaseClient()

  try {
    const context = createReadyCardRequestContext({
      cookiesList: await cookies(),
      headersList: await headers(),
    })
    const card = await getNextReadyCardForVisitor(client, context)

    if (!card) {
      return NextResponse.json<ReadyCardErrorResponse>(
        {
          error: "ready_card_not_found",
          message: "No ready 图文卡片 is available in the local store.",
        },
        { status: 404 }
      )
    }

    return NextResponse.json<ReadyCardResponse>({ card })
  } finally {
    client.sqlite.close()
  }
}
