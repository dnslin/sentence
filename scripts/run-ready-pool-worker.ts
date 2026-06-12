import { createDatabaseClient } from "@/lib/db/client"
import { loadXaiConfig } from "@/lib/generation/xai-config"
import {
  createProductionReadyPoolGenerator,
  runReadyPoolWorkerLoop,
} from "@/lib/worker/ready-pool-worker"

const stopSignal = { stopped: false }

process.on("SIGINT", () => {
  stopSignal.stopped = true
})
process.on("SIGTERM", () => {
  stopSignal.stopped = true
})

try {
  loadXaiConfig()
} catch {
  console.error(
    "XAI_API_KEY is required for the ready-pool worker. Set it in the server environment before running pnpm worker:ready-pool."
  )
  process.exitCode = 1
  process.exit()
}

await import("./migrate")

const client = createDatabaseClient()

try {
  await runReadyPoolWorkerLoop({
    client,
    generateReadyCard: createProductionReadyPoolGenerator(client),
    stopSignal,
    onSummary(summary) {
      console.log(JSON.stringify(summary))
    },
  })
} finally {
  client.sqlite.close()
}
