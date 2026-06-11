import { NextResponse } from "next/server"

import { getOneReadyCard } from "@/lib/cards/ready-card-repository"
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
    const card = await getOneReadyCard(client)

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
