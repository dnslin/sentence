import { expect, test } from "@playwright/test"

import {
  isReadyCardResponse,
  type ReadyCardResponse,
} from "@/lib/cards/public-ready-card"
import { seedReadyCard, seedReadyCardStore } from "@/lib/cards/seed-ready-card"
import { createDatabaseClient } from "@/lib/db/client"
import { cards, readyCardViews, sentences } from "@/lib/db/schema"

import { seedExtraReadyCardFixtures } from "./ready-card-fixtures"

const e2eDatabasePath = "test-data/e2e/juhua.sqlite"

const seedCard = {
  id: seedReadyCard.card.id,
  sentence: seedReadyCard.sentence.text,
  sceneLabel: seedReadyCard.card.sceneLabel,
  accent: seedReadyCard.card.accent,
  status: seedReadyCard.card.status,
} as const

async function withE2eDatabase<T>(
  callback: (client: ReturnType<typeof createDatabaseClient>) => Promise<T>
) {
  const previousDatabasePath = process.env.JUHUA_DATABASE_PATH
  process.env.JUHUA_DATABASE_PATH = e2eDatabasePath
  const client = createDatabaseClient()

  try {
    return await callback(client)
  } finally {
    client.sqlite.close()

    if (previousDatabasePath === undefined) {
      delete process.env.JUHUA_DATABASE_PATH
    } else {
      process.env.JUHUA_DATABASE_PATH = previousDatabasePath
    }
  }
}

async function seedE2eReadyCardStore() {
  await withE2eDatabase(async (client) => {
    await client.db.delete(readyCardViews)
    await seedReadyCardStore(client)
    await seedExtraReadyCardFixtures(client)
  })
}

async function clearReadyCards() {
  await withE2eDatabase(async (client) => {
    await client.db.delete(readyCardViews)
    await client.db.delete(cards)
    await client.db.delete(sentences)
  })
}

async function getReadyCard(
  response: Awaited<ReturnType<typeof fetchReadyCard>>
) {
  expect(response.status()).toBe(200)
  const body: unknown = await response.json()
  expect(isReadyCardResponse(body)).toBe(true)
  return (body as ReadyCardResponse).card
}

async function fetchReadyCard(requestContext: {
  get(
    url: string
  ): Promise<{
    status(): number
    json(): Promise<unknown>
    headers(): Record<string, string>
  }>
}) {
  return requestContext.get("/api/ready-card")
}

test.beforeEach(async () => {
  await seedE2eReadyCardStore()
})

test("serves a ready card from the public API and sets anonymous identity", async ({
  request,
}) => {
  const response = await fetchReadyCard(request)
  const card = await getReadyCard(response)

  expect(card).toEqual(seedCard)
  expect(response.headers()["set-cookie"]).toContain("juhua_anonymous_id=")
})

test("avoids the prior 50 cards for one API visitor when enough cards exist", async ({
  request,
}) => {
  const seenIds: string[] = []

  for (let index = 0; index < 55; index += 1) {
    const card = await getReadyCard(await fetchReadyCard(request))
    const prior50 = seenIds.slice(-50)

    expect(prior50).not.toContain(card.id)
    seenIds.push(card.id)
  }
})

test("keeps recent history stable when IP context changes for the same cookie", async ({
  playwright,
}) => {
  const visitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    const firstCard = await getReadyCard(
      await visitor.get("/api/ready-card", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      })
    )
    const secondCard = await getReadyCard(
      await visitor.get("/api/ready-card", {
        headers: { "x-forwarded-for": "203.0.113.5" },
      })
    )

    expect(secondCard.id).not.toBe(firstCard.id)
  } finally {
    await visitor.dispose()
  }
})

test("serializes concurrent refresh selection for one visitor", async ({
  request,
}) => {
  await getReadyCard(await fetchReadyCard(request))

  const cards = await Promise.all(
    Array.from({ length: 5 }, async () =>
      getReadyCard(await fetchReadyCard(request))
    )
  )
  const uniqueIds = new Set(cards.map((card) => card.id))

  expect(uniqueIds.size).toBe(cards.length)
})

test("sets secure anonymous cookie behind forwarded HTTPS", async ({
  playwright,
}) => {
  const visitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    const response = await visitor.get("/api/ready-card", {
      headers: { "x-forwarded-proto": "https" },
    })
    await getReadyCard(response)

    expect(response.headers()["set-cookie"]).toContain("Secure")
  } finally {
    await visitor.dispose()
  }
})

test("keeps different anonymous API visitors isolated", async ({
  playwright,
}) => {
  const firstVisitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })
  const secondVisitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    await getReadyCard(await fetchReadyCard(firstVisitor))
    await getReadyCard(await fetchReadyCard(firstVisitor))

    const secondVisitorCard = await getReadyCard(
      await fetchReadyCard(secondVisitor)
    )
    expect(secondVisitorCard).toEqual(seedCard)
  } finally {
    await firstVisitor.dispose()
    await secondVisitor.dispose()
  }
})

test("enforces ready-card view foreign keys on runtime connections", async () => {
  await expect(
    withE2eDatabase(async (client) => {
      await client.db.insert(readyCardViews).values({
        id: "test-invalid-view",
        visitorKey: "test-visitor",
        cardId: "missing-card",
        seenAt: new Date(),
      })
    })
  ).rejects.toThrow()
})

test("renders the API-backed ready card on the homepage", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("article", { name: "图文卡片预览" })
  ).toBeVisible()
  await expect(page.getByText(`“${seedCard.sentence}”`)).toBeVisible()
  await expect(
    page.getByRole("img", { name: seedCard.sceneLabel })
  ).toBeVisible()
})

test("refresh replaces the displayed sentence and illustration binding", async ({
  page,
}) => {
  await page.goto("/")

  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()
  const initialImageLabel = await page
    .getByRole("img")
    .getAttribute("aria-label")

  const apiResponse = page.waitForResponse("**/api/ready-card")
  await page.getByRole("button", { name: "再来一张" }).click()
  await apiResponse

  await expect(page.getByText("已刷新生成新的图文卡片。")).toBeVisible()
  const updatedSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()
  const updatedImageLabel = await page
    .getByRole("img")
    .getAttribute("aria-label")

  expect(updatedSentence).not.toBe(initialSentence)
  expect(updatedImageLabel).not.toBe(initialImageLabel)
})

test("records homepage card in the same recent window used by API refresh", async ({
  page,
}) => {
  await page.goto("/")

  const response = await page.request.get("/api/ready-card")
  const card = await getReadyCard(response)

  expect(card.id).not.toBe(seedCard.id)
})

test("shows loading transition and prevents duplicate refresh clicks", async ({
  page,
}) => {
  let requestCount = 0
  let releaseResponse: (() => void) | undefined

  await page.route("**/api/ready-card", async (route) => {
    requestCount += 1
    await new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    await route.continue()
  })

  await page.goto("/")
  const refreshButton = page.getByRole("button", { name: "再来一张" })
  await refreshButton.click()

  await expect(page.getByRole("button", { name: "刷新生成中" })).toBeDisabled()
  await expect(
    page.getByRole("article", { name: "图文卡片预览" })
  ).toHaveAttribute("aria-busy", "true")
  await page.getByRole("button", { name: "刷新生成中" }).click({ force: true })
  expect(requestCount).toBe(1)

  releaseResponse?.()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()
})

test("refresh failure keeps current card and allows retry", async ({
  page,
}) => {
  await page.goto("/")
  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()
  let failOnce = true

  await page.route("**/api/ready-card", async (route) => {
    if (failOnce) {
      failOnce = false
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "test_failure" }),
      })
      return
    }

    await route.continue()
  })

  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(
    page.getByText("刷新生成失败，当前图文卡片已保留。请稍后再试。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()

  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(page.getByText("已刷新生成新的图文卡片。")).toBeVisible()
  const updatedSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()
  expect(updatedSentence).not.toBe(initialSentence)
})

test("keeps seeding idempotent for a fresh public ready-card visitor", async ({
  playwright,
}) => {
  const beforeVisitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })
  const afterVisitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    const beforeCard = await getReadyCard(await fetchReadyCard(beforeVisitor))
    await seedE2eReadyCardStore()
    const afterCard = await getReadyCard(await fetchReadyCard(afterVisitor))

    expect(beforeCard).toEqual(seedCard)
    expect(afterCard).toEqual(seedCard)
  } finally {
    await beforeVisitor.dispose()
    await afterVisitor.dispose()
  }
})

test("returns ready_card_not_found when no ready cards exist", async ({
  request,
}) => {
  await clearReadyCards()

  const response = await fetchReadyCard(request)
  expect(response.status()).toBe(404)
  await expect(response.json()).resolves.toMatchObject({
    error: "ready_card_not_found",
  })
})
