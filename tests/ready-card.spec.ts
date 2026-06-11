import { expect, test } from "@playwright/test"

import type { ReadyCardResponse } from "@/lib/cards/public-ready-card"

const seedCard = {
  id: "seed-quiet-gallery-card",
  sentence: "风停在窗边，像一封没有署名的信。",
  sceneLabel: "晨光里的窗边小路",
  accent: "dawn",
  status: "ready",
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

  const after = await request.get("/api/ready-card")
  expect(after.status()).toBe(200)
  const afterBody = await after.json()

  await expectSeedReadyCard(afterBody)
  expect(afterBody).toEqual(beforeBody)
})
