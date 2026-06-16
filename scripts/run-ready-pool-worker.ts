import { createRequire } from "node:module"

import { createDatabaseClient } from "@/lib/db/client"
import { loadXaiConfig } from "@/lib/generation/xai-config"

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env"
) as typeof import("@next/env")

loadEnvConfig(process.cwd())
import {
  createProductionReadyPoolGenerator,
  runReadyPoolWorkerLoop,
  type ReadyPoolStopSignal,
} from "@/lib/worker/ready-pool-worker"

const stopSignal: { stopped: boolean } = { stopped: false }
const sleepAbortController = new AbortController()

function requestStop() {
  stopSignal.stopped = true
  sleepAbortController.abort()
}

function createInterruptibleSleep(abortSignal: AbortSignal) {
  return ({
    durationMs,
    stopSignal,
  }: {
    durationMs: number
    stopSignal?: ReadyPoolStopSignal
  }) =>
    new Promise<void>((resolve) => {
      if (stopSignal?.stopped || abortSignal.aborted) {
        resolve()
        return
      }

      const timeout = setTimeout(resolve, durationMs)
      abortSignal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout)
          resolve()
        },
        { once: true }
      )
    })
}

process.on("SIGINT", requestStop)
process.on("SIGTERM", requestStop)

let hasConfig = true
try {
  loadXaiConfig()
} catch {
  console.error(
    "XAI_API_KEY is required for the ready-pool worker. Set it in the server environment before running pnpm worker:ready-pool."
  )
  process.exitCode = 1
  hasConfig = false
}

if (hasConfig) {
  await import("./migrate")

  const client = createDatabaseClient()

  try {
    await runReadyPoolWorkerLoop({
      client,
      generateReadyCard: createProductionReadyPoolGenerator(client),
      stopSignal,
      sleep: createInterruptibleSleep(sleepAbortController.signal),
      onProgress(progress) {
        console.log(JSON.stringify(progress))
      },
      onSummary(summary) {
        console.log(
          JSON.stringify({ event: "replenishment_summary", ...summary })
        )
      },
      onError(error) {
        console.error(JSON.stringify({ event: "worker_error", ...error }))
      },
    })
  } finally {
    client.sqlite.close()
  }
}
