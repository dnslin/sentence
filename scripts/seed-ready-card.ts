import { seedReadyCardStore } from "@/lib/cards/seed-ready-card"
import { createDatabaseClient } from "@/lib/db/client"

const client = createDatabaseClient()

try {
  await seedReadyCardStore(client)
} finally {
  client.sqlite.close()
}
