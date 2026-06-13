import { cookies, headers } from "next/headers"

import { createReadyCardRequestContext } from "@/lib/cards/ready-card-request-context"
import { getRateLimitedNextReadyCardForVisitor } from "@/lib/cards/rate-limited-ready-card"
import { createDatabaseClient } from "@/lib/db/client"

import { HomeExperience } from "./home-experience"

export const dynamic = "force-dynamic"

export default async function Page() {
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

    return (
      <HomeExperience
        card={result.status === "allowed" ? result.card : null}
        isLimited={result.status === "limited"}
      />
    )
  } finally {
    client.sqlite.close()
  }
}
