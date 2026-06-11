import { getOneReadyCard } from "@/lib/cards/ready-card-repository"
import { createDatabaseClient } from "@/lib/db/client"

import { HomeExperience } from "./home-experience"

export const dynamic = "force-dynamic"

export default async function Page() {
  const client = createDatabaseClient()

  try {
    const card = await getOneReadyCard(client)

    if (!card) {
      throw new Error("No ready 图文卡片 is available. Run `pnpm db:setup` to initialize the local store.")
    }

    return <HomeExperience card={card} />
  } finally {
    client.sqlite.close()
  }
}
