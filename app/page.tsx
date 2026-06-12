import { cookies, headers } from "next/headers"

import { createReadyCardRequestContext } from "@/lib/cards/ready-card-request-context"
import { getNextReadyCardForVisitor } from "@/lib/cards/ready-card-repository"
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
    const card = await getNextReadyCardForVisitor(client, context)

    return <HomeExperience card={card} />
  } finally {
    client.sqlite.close()
  }
}
