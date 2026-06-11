import { expect, test } from "@playwright/test"

import { seedReadyCard, seedReadyCardStore } from "@/lib/cards/seed-ready-card"
import { createDatabaseClient } from "@/lib/db/client"

import type { ReadyCardResponse } from "@/lib/cards/public-ready-card"

const e2eDatabasePath = "test-data/e2e/juhua.sqlite"

const seedCard = {
  id: seedReadyCard.card.id,
  sentence: seedReadyCard.sentence.text,
  sceneLabel: seedReadyCard.card.sceneLabel,
  accent: seedReadyCard.card.accent,
  status: seedReadyCard.card.status,
} as const

function isReadyCardResponse(value: unknown): value is ReadyCardResponse {
  if (typeof value !== "object" || value === null) return false

  const response = value as { card?: unknown }
  if (typeof response.card !== "object" || response.card === null) return false

  const card = response.card as Record<string, unknown>
  return (
    typeof card.id === "string" &&
    typeof card.sentence === "string" &&
    typeof card.sceneLabel === "string" &&
    typeof card.accent === "string" &&
    typeof card.status === "string"
  )
}

async function rerunSeedReadyCardStore() {
  const previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  process.env.JUHUA_DATABASE_PATH = e2eDatabasePath

  const client = createDatabaseClient()

  try {
    await seedReadyCardStore(client)
  } finally {
    client.sqlite.close()

    if (previousDatabasePath === undefined) {
      delete process.env.JUHUA_DATABASE_PATH
    } else {
      process.env.JUHUA_DATABASE_PATH = previousDatabasePath
    }
  }
}

async function expectSeedReadyCard(responseBody: unknown) {
  expect(isReadyCardResponse(responseBody)).toBe(true)
  const readyCardResponse = responseBody as ReadyCardResponse
  expect(readyCardResponse).toEqual({ card: seedCard })
}

test("serves one ready card from the public API", async ({ request }) => {
  const response = await request.get("/api/ready-card")

  expect(response.status()).toBe(200)
  await expectSeedReadyCard(await response.json())
})

test("renders the API-backed ready card on the homepage", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("article", { name: "图文卡片预览" })).toBeVisible()
  await expect(page.getByText(`“${seedCard.sentence}”`)).toBeVisible()
  await expect(page.getByRole("img", { name: seedCard.sceneLabel })).toBeVisible()
})

test("keeps seeding idempotent for the public ready card", async ({ request }) => {
  const before = await request.get("/api/ready-card")
  expect(before.status()).toBe(200)
  const beforeBody = await before.json()

  await rerunSeedReadyCardStore()

  const after = await request.get("/api/ready-card")
  expect(after.status()).toBe(200)
  const afterBody = await after.json()

  await expectSeedReadyCard(afterBody)
  expect(afterBody).toEqual(beforeBody)
})
