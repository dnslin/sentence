import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import {
  READY_CARD_EXPORT_HEIGHT,
  READY_CARD_EXPORT_WIDTH,
} from "@/lib/card-export/constants"
import {
  isCardActionRequest,
  isReadyCardResponse,
  type ReadyCardResponse,
} from "@/lib/cards/public-ready-card"
import { seedReadyCard, seedReadyCardStore } from "@/lib/cards/seed-ready-card"
import { createDatabaseClient } from "@/lib/db/client"
import { rateLimitConfigs, cardActionNames } from "@/lib/rate-limit/actions"
import {
  cards,
  rateLimitWindows,
  readyCardViews,
  sentences,
} from "@/lib/db/schema"

import { sql } from "drizzle-orm"

import { seedExtraReadyCardFixtures } from "./ready-card-fixtures"

const e2eDatabasePath = "test-data/e2e/juhua.sqlite"
const generatedIllustrationRoot = join(
  process.cwd(),
  "data",
  "generated-illustrations"
)
const generatedIllustrationFilename =
  "11111111-1111-4111-8111-111111111111.webp"
const generatedIllustrationUrl = `/generated-illustrations/${generatedIllustrationFilename}`
const generatedIllustrationBytes = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00, 0x10, 0x07,
  0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00,
])

const seedCard = {
  id: seedReadyCard.card.id,
  sentence: seedReadyCard.sentence.text,
  sceneLabel: seedReadyCard.card.sceneLabel,
  accent: seedReadyCard.card.accent,
  status: seedReadyCard.card.status,
  illustrationUrl: null,
} as const

const longSentenceCard = {
  id: "test-long-sentence-card",
  sentence: "某些人喜好名利是“好大喜功”，某些人喜好名利是“人之常情”。",
  sceneLabel: "测试长句插画场景",
  accent: "rain",
  status: "ready",
  illustrationUrl: null,
} as const

const expectedCardActionMessages = {
  download: "PNG 可以开始准备；浏览器会下载当前这张图文卡片。",
  share: "分享可以开始准备；浏览器会分享或下载当前这张图文卡片。",
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
    await client.db.delete(rateLimitWindows)
    await client.db.delete(readyCardViews)
    await seedReadyCardStore(client)
    await seedExtraReadyCardFixtures(client)
  })
}

async function seedGeneratedIllustrationReadyCard() {
  mkdirSync(generatedIllustrationRoot, { recursive: true })
  writeFileSync(
    join(generatedIllustrationRoot, generatedIllustrationFilename),
    generatedIllustrationBytes
  )

  await withE2eDatabase(async (client) => {
    await client.db
      .insert(sentences)
      .values({
        id: "test-generated-sentence",
        text: "有一束光，正在纸上慢慢醒来。",
        source: "test-fixture",
        createdAt: new Date("2026-06-11T02:00:00.000Z"),
      })
      .onConflictDoUpdate({
        target: sentences.id,
        set: {
          text: sql.raw("excluded.text"),
          source: sql.raw("excluded.source"),
        },
      })
    await client.db
      .insert(cards)
      .values({
        id: "test-generated-card",
        sentenceId: "test-generated-sentence",
        status: "ready",
        sceneLabel: "真实 WebP 插画场景",
        accent: "dawn",
        illustrationPath: generatedIllustrationUrl,
        styleVersion: "quiet-gallery-v1",
        createdAt: new Date("2026-06-11T02:00:00.000Z"),
        updatedAt: new Date("2026-06-11T02:00:00.000Z"),
      })
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          sentenceId: sql.raw("excluded.sentence_id"),
          status: sql.raw("excluded.status"),
          sceneLabel: sql.raw("excluded.scene_label"),
          accent: sql.raw("excluded.accent"),
          illustrationPath: sql.raw("excluded.illustration_path"),
          styleVersion: sql.raw("excluded.style_version"),
          updatedAt: sql.raw("excluded.updated_at"),
        },
      })
  })
}

async function seedUnsafeIllustrationPathReadyCard() {
  await withE2eDatabase(async (client) => {
    await client.db.delete(rateLimitWindows)
    await client.db.delete(readyCardViews)
    await client.db.delete(cards)
    await client.db.delete(sentences)
    await client.db.insert(sentences).values({
      id: "test-unsafe-sentence",
      text: "风从窗边经过，留下很轻的影子。",
      source: "test-fixture",
      createdAt: new Date("2026-06-11T03:00:00.000Z"),
    })
    await client.db.insert(cards).values({
      id: "test-unsafe-card",
      sentenceId: "test-unsafe-sentence",
      status: "ready",
      sceneLabel: "不安全插画路径场景",
      accent: "moon",
      illustrationPath: "https://example.com/unsafe.webp",
      styleVersion: "quiet-gallery-v1",
      createdAt: new Date("2026-06-11T03:00:00.000Z"),
      updatedAt: new Date("2026-06-11T03:00:00.000Z"),
    })
  })
}

async function clearReadyCards() {
  await withE2eDatabase(async (client) => {
    await client.db.delete(rateLimitWindows)
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
  get(url: string): Promise<{
    status(): number
    json(): Promise<unknown>
    headers(): Record<string, string>
  }>
}) {
  return requestContext.get("/api/ready-card")
}

async function countReadyCardViews() {
  return withE2eDatabase(async (client) => {
    const rows = await client.db.select().from(readyCardViews)
    return rows.length
  })
}

async function consumeReadyCardLimit(requestContext: {
  get(url: string): Promise<{ status(): number; json(): Promise<unknown> }>
}) {
  for (let index = 0; index < rateLimitConfigs.refresh.limit; index += 1) {
    expect((await requestContext.get("/api/ready-card")).status()).toBe(200)
  }
}

async function consumeCardActionLimit(
  requestContext: {
    post(
      url: string,
      options: { data: { action: "download" | "share" } }
    ): Promise<{ status(): number; json(): Promise<unknown> }>
  },
  action: "download" | "share",
  count: number = rateLimitConfigs[action].limit
) {
  for (let index = 0; index < count; index += 1) {
    const response = await requestContext.post("/api/card-action", {
      data: { action },
    })
    expect(response.status()).toBe(200)
  }
}

test.beforeEach(async () => {
  rmSync(join(generatedIllustrationRoot, generatedIllustrationFilename), {
    force: true,
  })
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

test("blocks refresh at the hourly limit without recording a ready-card view", async ({
  request,
}) => {
  await consumeReadyCardLimit(request)
  const viewsBeforeBlockedRequest = await countReadyCardViews()

  const response = await request.get("/api/ready-card")
  expect(response.status()).toBe(429)
  const body: unknown = await response.json()
  expect(body).toMatchObject({
    error: "ready_card_limited",
    message: "刷新生成有点频繁了，先让当前图文卡片停留一会儿。",
  })
  expect(response.headers()["retry-after"]).toBeTruthy()
  expect(await countReadyCardViews()).toBe(viewsBeforeBlockedRequest)
})

test("limits download and share action requests", async ({ request }) => {
  for (const action of cardActionNames) {
    await seedE2eReadyCardStore()

    const allowed = await request.post("/api/card-action", { data: { action } })
    expect(allowed.status()).toBe(200)
    expect(await allowed.json()).toMatchObject({
      action,
      status: "allowed",
      message: expectedCardActionMessages[action],
    })

    await consumeCardActionLimit(
      request,
      action,
      rateLimitConfigs[action].limit - 1
    )
    const blocked = await request.post("/api/card-action", { data: { action } })
    expect(blocked.status()).toBe(429)
    expect(await blocked.json()).toMatchObject({
      error: "ready_card_limited",
      message: "这个操作有点频繁了，先让当前图文卡片停留一会儿。",
    })
  }
})

test("keeps one refresh quota window when clients spoof x-forwarded-for", async ({
  playwright,
}) => {
  const visitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    for (let index = 0; index < rateLimitConfigs.refresh.limit; index += 1) {
      const response = await visitor.get("/api/ready-card", {
        headers: { "x-forwarded-for": `198.51.100.${index % 200}` },
      })
      expect(response.status()).toBe(200)
    }

    const blocked = await visitor.get("/api/ready-card", {
      headers: { "x-forwarded-for": "203.0.113.250" },
    })
    expect(blocked.status()).toBe(429)
    expect(await blocked.json()).toMatchObject({
      error: "ready_card_limited",
      message: "刷新生成有点频繁了，先让当前图文卡片停留一会儿。",
    })
  } finally {
    await visitor.dispose()
  }
})

test("renders calm homepage limit feedback instead of selecting another card", async ({
  page,
}) => {
  await consumeReadyCardLimit(page.request)
  const viewsBeforeLimitedHomepage = await countReadyCardViews()

  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "刷新生成有点频繁了。" })
  ).toBeVisible()
  await expect(
    page.getByText("先让当前节奏安静一会儿，稍后再回来继续看新的图文卡片。")
  ).toBeVisible()
  await expect(page.getByRole("article", { name: "图文卡片预览" })).toHaveCount(
    0
  )
  expect(await countReadyCardViews()).toBe(viewsBeforeLimitedHomepage)
})

test("rejects invalid card action requests safely", async ({ request }) => {
  const response = await request.post("/api/card-action", {
    data: { action: "print" },
  })

  expect(response.status()).toBe(400)
  expect(await response.json()).toMatchObject({
    error: "invalid_card_action",
    message: "这个操作暂时不能处理，请回到图文卡片后再试。",
  })
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

test("neutralizes non-essential homepage card motion for reduced-motion users", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")

  const article = page.getByRole("article", { name: "图文卡片预览" })
  await expect(article).toBeVisible()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()

  const motionState = await article.evaluate((node) => {
    const styles = getComputedStyle(node)

    return {
      opacity: styles.opacity,
      rotate: styles.rotate,
      scale: styles.scale,
      transform: styles.transform,
      transitionDuration: styles.transitionDuration,
    }
  })

  expect(motionState.opacity).toBe("1")
  expect(["none", "0deg"]).toContain(motionState.rotate)
  expect(["none", "1"]).toContain(motionState.scale)
  expect(motionState.transform).toBe("none")
  expect(motionState.transitionDuration).toBe("0s")
})

test("keeps a max-length sentence inside the quiet-gallery card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 325, height: 680 })
  await page.route("**/api/ready-card", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ card: longSentenceCard }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(page.getByText(`“${longSentenceCard.sentence}”`)).toBeVisible()

  const article = page.getByRole("article", { name: "图文卡片预览" })
  const paragraph = article.locator("p")
  const sentencePanelOverflows = await paragraph.evaluate((node) => {
    const panel = node.parentElement

    return panel ? panel.scrollHeight > panel.clientHeight + 1 : true
  })

  expect(sentencePanelOverflows).toBe(false)
})

test("renders a calm empty-stock homepage when no ready cards exist", async ({
  page,
}) => {
  await clearReadyCards()
  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: "这会儿还没有准备好的图文卡片。",
    })
  ).toBeVisible()
  await expect(
    page.getByText(
      "新的图文绑定还在慢慢准备中。请稍后再来看看，我们不会让你等待现场生成。"
    )
  ).toBeVisible()
  await expect(
    page.getByText("图文卡片会从已经准备好的图文绑定中呈现")
  ).toBeVisible()
  await expect(page.getByText(/先呈现一张已准备好的图文卡片/)).toHaveCount(0)
  await expect(page.getByText(/再来一张会刷新生成新的图文绑定/)).toHaveCount(0)
  await expect(
    page.getByText(/Run `pnpm db:setup`|local store|数据库|stack/i)
  ).toHaveCount(0)
  await expect(page.getByRole("article", { name: "图文卡片预览" })).toHaveCount(
    0
  )
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

  await expect(page.getByRole("button", { name: "刷新中" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "下载" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "分享" })).toBeDisabled()
  await expect(
    page.getByRole("article", { name: "图文卡片预览" })
  ).toHaveAttribute("aria-busy", "true")
  await page.getByRole("button", { name: "刷新中" }).click({ force: true })
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
    page.getByText("刷新生成暂时没有成功，当前图文卡片已保留。请稍后再试。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()

  await page.getByRole("button", { name: "再来一张" }).click()
  const sentence = page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
  await expect(sentence).not.toHaveText(initialSentence ?? "")
})

test("refresh empty-stock response keeps current card and allows retry", async ({
  page,
}) => {
  await page.goto("/")
  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  await page.route("**/api/ready-card", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: "ready_card_not_found",
        message: "这会儿还没有准备好的图文卡片。",
      }),
    })
  })

  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(
    page.getByText("新的图文卡片还在准备中，当前这一张已保留。请稍后再试。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()
})

test("refresh limit response keeps current card and shows gentle copy", async ({
  page,
}) => {
  await page.goto("/")
  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  await page.route("**/api/ready-card", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "ready_card_limited",
        message: "刷新生成有点频繁了，先让当前图文卡片停留一会儿。",
      }),
    })
  })

  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(
    page.getByText("刷新生成有点频繁了，先让当前图文卡片停留一会儿。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()
})

async function downloadCurrentCard(page: Page) {
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "下载" }).click()

  return downloadPromise
}

async function installDownloadInspection(page: Page) {
  await page.addInitScript(() => {
    type DownloadInspectionWindow = typeof window & {
      __lastDownloadUrl?: string
      __revokedDownloadUrls?: string[]
    }

    const originalRevokeObjectUrl = URL.revokeObjectURL
    URL.revokeObjectURL = function revokeObjectURL(url) {
      ;((window as DownloadInspectionWindow).__revokedDownloadUrls ??= []).push(
        url
      )
      originalRevokeObjectUrl.call(URL, url)
    }

    const originalClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function click() {
      if (this.download) {
        ;(window as DownloadInspectionWindow).__lastDownloadUrl = this.href
      }
      return originalClick.call(this)
    }
  })
}

async function getRevokedDownloadUrls(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __revokedDownloadUrls?: string[] })
        .__revokedDownloadUrls ?? []
  )
}

async function inspectDownloadedPng(page: Page) {
  return page.evaluate(async () => {
    type DownloadInspectionWindow = typeof window & {
      __lastDownloadUrl?: string
    }

    const downloadUrl = (window as DownloadInspectionWindow).__lastDownloadUrl
    if (!downloadUrl) throw new Error("download URL was not captured")

    const response = await fetch(downloadUrl)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("test canvas unavailable")

    context.drawImage(bitmap, 0, 0)
    const illustrationPixel = Array.from(
      context.getImageData(540, 420, 1, 1).data
    )
    const sentencePanelPixel = Array.from(
      context.getImageData(540, 1060, 1, 1).data
    )
    const pageBackgroundPixel = Array.from(
      context.getImageData(12, 12, 1, 1).data
    )

    bitmap.close()

    return {
      width: canvas.width,
      height: canvas.height,
      illustrationPixel,
      sentencePanelPixel,
      pageBackgroundPixel,
    }
  })
}

async function compareDownloadedPngToVisibleCard(
  page: Page,
  visibleCardPng: Buffer
) {
  return page.evaluate(async (visibleCardPngBase64) => {
    type DownloadInspectionWindow = typeof window & {
      __lastDownloadUrl?: string
    }
    type Pixel = [number, number, number, number]

    const downloadUrl = (window as DownloadInspectionWindow).__lastDownloadUrl
    if (!downloadUrl) throw new Error("download URL was not captured")

    function blobFromBase64(base64: string) {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return new Blob([bytes], { type: "image/png" })
    }

    function sampleBitmap(bitmap: ImageBitmap) {
      const canvas = document.createElement("canvas")
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext("2d")
      if (!context) throw new Error("comparison canvas unavailable")

      context.drawImage(bitmap, 0, 0)
      return Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 7 }, (__, column) => ({
          x: (column + 1) / 8,
          y: (row + 1) / 10,
        }))
      )
        .flat()
        .map(({ x, y }) => {
          const pixel = context.getImageData(
            Math.round((bitmap.width - 1) * x),
            Math.round((bitmap.height - 1) * y),
            1,
            1
          ).data
          return Array.from(pixel) as Pixel
        })
    }

    function colorDistance(left: Pixel, right: Pixel) {
      return Math.hypot(
        left[0] - right[0],
        left[1] - right[1],
        left[2] - right[2],
        left[3] - right[3]
      )
    }

    const downloadedResponse = await fetch(downloadUrl)
    const downloadedBitmap = await createImageBitmap(
      await downloadedResponse.blob()
    )
    const visibleBitmap = await createImageBitmap(
      blobFromBase64(visibleCardPngBase64)
    )
    const downloadedSamples = sampleBitmap(downloadedBitmap)
    const visibleSamples = sampleBitmap(visibleBitmap)
    const distances = downloadedSamples.map((sample, index) =>
      colorDistance(sample, visibleSamples[index] ?? sample)
    )

    downloadedBitmap.close()
    visibleBitmap.close()

    const sortedDistances = [...distances].sort((left, right) => left - right)
    const p90Distance =
      sortedDistances[Math.floor((sortedDistances.length - 1) * 0.9)] ?? 0

    return {
      distances,
      p90Distance,
      averageDistance:
        distances.reduce((total, distance) => total + distance, 0) /
        distances.length,
      downloadedSamples,
      visibleSamples,
    }
  }, visibleCardPng.toString("base64"))
}

test("downloads the current card as a 1080x1350 PNG artifact", async ({
  page,
}) => {
  await installDownloadInspection(page)

  await page.goto("/")
  const visibleSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  const download = await downloadCurrentCard(page)
  expect(download.suggestedFilename()).toMatch(
    /^juhua-\d{4}-\d{2}-\d{2}-.+\.png$/
  )
  await expect(
    page.getByText("PNG 已准备好，浏览器会开始下载这张图文卡片。")
  ).toHaveCount(0)

  const png = await inspectDownloadedPng(page)
  expect(await getRevokedDownloadUrls(page)).toEqual([])
  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
  expect(png.illustrationPixel).not.toEqual(png.sentencePanelPixel)
  expect(png.pageBackgroundPixel).not.toEqual([247, 242, 234, 255])
  expect(visibleSentence).toBe(`“${seedCard.sentence}”`)
})

test("downloaded PNG keeps the visible quiet-gallery card style", async ({
  page,
}) => {
  await installDownloadInspection(page)

  await page.goto("/")
  const visibleCardPng = await page
    .getByRole("article", { name: "图文卡片预览" })
    .screenshot()

  await downloadCurrentCard(page)
  const comparison = await compareDownloadedPngToVisibleCard(
    page,
    visibleCardPng
  )

  expect(comparison.p90Distance).toBeLessThanOrEqual(45)
  expect(comparison.averageDistance).toBeLessThanOrEqual(20)
})

test("downloads a card with a same-origin WebP illustration", async ({
  page,
}) => {
  const imageRequests: string[] = []

  await clearReadyCards()
  await seedGeneratedIllustrationReadyCard()
  await installDownloadInspection(page)
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname === generatedIllustrationUrl)
      imageRequests.push(url.pathname)
  })

  await page.goto("/")
  await expect(
    page.getByRole("img", { name: "真实 WebP 插画场景" })
  ).toBeVisible()

  await downloadCurrentCard(page)
  const png = await inspectDownloadedPng(page)

  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
  expect(imageRequests).toContain(generatedIllustrationUrl)
})

test("download waits for the current WebP illustration before exporting", async ({
  page,
}) => {
  let shouldHoldImage = true
  let releaseImage: (() => void) | undefined
  let sawDownload = false

  await clearReadyCards()
  await seedGeneratedIllustrationReadyCard()
  await installDownloadInspection(page)
  await page.route(`**${generatedIllustrationUrl}`, async (route) => {
    if (shouldHoldImage) {
      shouldHoldImage = false
      await new Promise<void>((resolve) => {
        releaseImage = resolve
      })
    }

    await route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: generatedIllustrationBytes,
    })
  })
  page.on("download", () => {
    sawDownload = true
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("“有一束光，正在纸上慢慢醒来。”")).toBeVisible()
  await page.getByRole("button", { name: "下载" }).click()
  await expect(page.getByRole("button", { name: "准备中" })).toBeDisabled()
  await page.waitForTimeout(300)
  expect(sawDownload).toBe(false)

  const downloadAfterImage = page.waitForEvent("download")
  releaseImage?.()
  await downloadAfterImage
  await expect(
    page.getByText("PNG 已准备好，浏览器会开始下载这张图文卡片。")
  ).toHaveCount(0)
})

test("download exports the refreshed current card instead of stale seed data", async ({
  page,
}) => {
  const exportedCardIds: string[] = []

  await installDownloadInspection(page)
  await page.route("**/api/card-action", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "download",
        status: "allowed",
        message: "allowed",
      }),
    })
  })
  await page.route("**/api/ready-card", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        card: {
          id: "test-refreshed-download-card",
          sentence: "新的风把纸页轻轻翻亮。",
          sceneLabel: "测试刷新后的插画场景",
          accent: "rain",
          status: "ready",
          illustrationUrl: null,
        },
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(page.getByText("“新的风把纸页轻轻翻亮。”")).toBeVisible()

  const refreshedSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  page.on("download", (download) => {
    exportedCardIds.push(download.suggestedFilename())
  })
  await downloadCurrentCard(page)
  const png = await inspectDownloadedPng(page)

  expect(refreshedSentence).toBe("“新的风把纸页轻轻翻亮。”")
  expect(exportedCardIds[0]).toContain("test-refreshed-download-card")
  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
})

test("download limit response blocks PNG generation", async ({ page }) => {
  await page.route("**/api/card-action", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "ready_card_limited",
        message: "这个操作有点频繁了，先让当前图文卡片停留一会儿。",
      }),
    })
  })

  await page.goto("/")
  const unexpectedDownload = page.waitForEvent("download", { timeout: 750 })
  await page.getByRole("button", { name: "下载" }).click()
  await expect(
    page.getByText("这个操作有点频繁了，先让当前图文卡片停留一会儿。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "下载" })).toBeEnabled()
  await expect(unexpectedDownload).rejects.toThrow()
})

test("download export failure keeps current card and re-enables controls", async ({
  page,
}) => {
  await clearReadyCards()
  await seedGeneratedIllustrationReadyCard()
  await page.route(`**${generatedIllustrationUrl}`, async (route) => {
    await route.fulfill({ status: 404, body: "missing test image" })
  })

  await page.goto("/")
  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  await page.getByRole("button", { name: "下载" }).click()
  await expect(
    page.getByText("PNG 暂时没有准备成功，当前图文卡片已保留。请稍后再试。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "下载" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()
})

// One parameterized Web Share seam keeps __sharePayloads/__shareAttemptCount
// semantics identical across every capability scenario so the helpers cannot
// drift in counter or payload shape.
type WebShareCanShareMode =
  | "files-and-combined" // true only for one file AND string title+text (real browser)
  | "combined-unsupported" // true for files-only, false when combined with title+text
  | "always-false" // canShare exists but never confirms file sharing
  | "throws" // canShare throws (treated as unsupported)
  | "absent" // navigator.share/canShare are removed entirely

type WebShareShareMode =
  | "record" // resolves and records the shared payload
  | "abort" // rejects with AbortError (user cancelled the share sheet)
  | "not-allowed" // rejects with NotAllowedError (real failure)
  | "generic" // rejects with a generic Error (must-not-be-called paths)

type WebShareInspectionConfig = {
  canShare: WebShareCanShareMode
  share: WebShareShareMode
}

async function installWebShareInspection(
  page: Page,
  config: WebShareInspectionConfig
) {
  await page.addInitScript((inspectionConfig: WebShareInspectionConfig) => {
    type SharedFileInspection = {
      name: string
      type: string
      size: number
      width: number
      height: number
    }
    type WebShareInspectionWindow = typeof window & {
      __sharePayloads?: Array<{
        title?: string
        text?: string
        files: SharedFileInspection[]
      }>
      __shareAttemptCount?: number
    }

    if (inspectionConfig.canShare === "absent") {
      Reflect.deleteProperty(navigator, "share")
      Reflect.deleteProperty(navigator, "canShare")
      return
    }

    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data?: ShareData) => {
        const hasOneFile = Array.isArray(data?.files) && data.files.length === 1
        const hasCombinedMeta =
          typeof data?.title === "string" && typeof data?.text === "string"

        switch (inspectionConfig.canShare) {
          case "files-and-combined":
            return hasOneFile && hasCombinedMeta
          case "combined-unsupported":
            return hasOneFile && !hasCombinedMeta
          case "always-false":
            return false
          case "throws":
            throw new Error("test canShare threw")
        }
      },
    })

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data?: ShareData) => {
        const inspectionWindow = window as WebShareInspectionWindow
        inspectionWindow.__shareAttemptCount =
          (inspectionWindow.__shareAttemptCount ?? 0) + 1

        if (inspectionConfig.share === "abort") {
          throw new DOMException("Share canceled by test", "AbortError")
        }
        if (inspectionConfig.share === "not-allowed") {
          throw new DOMException("Share blocked by test", "NotAllowedError")
        }
        if (inspectionConfig.share === "generic") {
          throw new Error("test Web Share should not be called")
        }

        const files = Array.isArray(data?.files) ? data.files : []
        const inspectedFiles = await Promise.all(
          files.map(async (file) => {
            const bitmap = await createImageBitmap(file)
            const inspection: SharedFileInspection = {
              name: file.name,
              type: file.type,
              size: file.size,
              width: bitmap.width,
              height: bitmap.height,
            }
            bitmap.close()
            return inspection
          })
        )

        ;(inspectionWindow.__sharePayloads ??= []).push({
          title: data?.title,
          text: data?.text,
          files: inspectedFiles,
        })
      },
    })
  }, config)
}

function installSupportedWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "files-and-combined",
    share: "record",
  })
}

function installCombinedPayloadUnsupportedWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "combined-unsupported",
    share: "generic",
  })
}

function installUnsupportedWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "always-false",
    share: "generic",
  })
}

function installMissingApiWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "absent",
    share: "generic",
  })
}

function installThrowingCanShareWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "throws",
    share: "generic",
  })
}

function installRejectingWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "files-and-combined",
    share: "not-allowed",
  })
}

function installCancelledWebShareInspection(page: Page) {
  return installWebShareInspection(page, {
    canShare: "files-and-combined",
    share: "abort",
  })
}

async function getSharePayloads(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __sharePayloads?: unknown[] })
        .__sharePayloads ?? []
  )
}

async function getShareAttemptCount(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __shareAttemptCount?: number })
        .__shareAttemptCount ?? 0
  )
}

async function getLastDownloadUrl(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __lastDownloadUrl?: string })
        .__lastDownloadUrl
  )
}

test("shares the current card as a PNG file when Web Share file capability is supported", async ({
  page,
}) => {
  const actions: string[] = []

  await installDownloadInspection(page)
  await installSupportedWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    const body: unknown = route.request().postDataJSON()
    const action = isCardActionRequest(body) ? body.action : "missing"
    actions.push(action)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action,
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "分享" }).click()
  await expect(
    page.getByText("已打开系统分享，图文卡片 PNG 已交给浏览器处理。")
  ).toBeVisible()
  expect(await getLastDownloadUrl(page)).toBeUndefined()

  const sharePayloads = await getSharePayloads(page)
  expect(actions).toEqual(["share"])
  expect(sharePayloads).toEqual([
    {
      title: "句画图文卡片",
      text: "分享当前这张随机短句与非署名绘本风插画组成的图文卡片。",
      files: [
        {
          name: expect.stringMatching(/^juhua-\d{4}-\d{2}-\d{2}-.+\.png$/),
          type: "image/png",
          size: expect.any(Number),
          width: READY_CARD_EXPORT_WIDTH,
          height: READY_CARD_EXPORT_HEIGHT,
        },
      ],
    },
  ])
  expect(
    (sharePayloads[0] as { files?: Array<{ size?: number }> }).files?.[0]?.size
  ).toBeGreaterThan(0)
})

test("disables both action buttons while download export is pending", async ({
  page,
}) => {
  let releaseResponse: (() => void) | undefined

  await page.route("**/api/card-action", async (route) => {
    await new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "download",
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "下载" }).click()

  await expect(page.getByRole("button", { name: "准备中" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "分享" })).toBeDisabled()

  releaseResponse?.()
  await expect(page.getByRole("button", { name: "下载" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "再来一张" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "分享" })).toBeEnabled()
})

test("shares the refreshed current card instead of stale seed data", async ({
  page,
}) => {
  const actions: string[] = []

  await installDownloadInspection(page)
  await installSupportedWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    const body: unknown = route.request().postDataJSON()
    const action = isCardActionRequest(body) ? body.action : "missing"
    actions.push(action)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action,
        status: "allowed",
        message: "allowed",
      }),
    })
  })
  await page.route("**/api/ready-card", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        card: {
          id: "test-refreshed-share-card",
          sentence: "新的风把纸页轻轻翻亮。",
          sceneLabel: "测试刷新后的插画场景",
          accent: "rain",
          status: "ready",
          illustrationUrl: null,
        },
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "再来一张" }).click()
  await expect(page.getByText("“新的风把纸页轻轻翻亮。”")).toBeVisible()

  await page.getByRole("button", { name: "分享" }).click()
  await expect(
    page.getByText("已打开系统分享，图文卡片 PNG 已交给浏览器处理。")
  ).toBeVisible()

  const sharePayloads = await getSharePayloads(page)
  expect(actions).toEqual(["share"])
  expect(
    (sharePayloads[0] as { files?: Array<{ name?: string }> }).files?.[0]?.name
  ).toContain("test-refreshed-share-card")
  expect(await getLastDownloadUrl(page)).toBeUndefined()
})

test("falls back to downloading the current PNG when Web Share file capability is unsupported", async ({
  page,
}) => {
  const actions: string[] = []

  await installDownloadInspection(page)
  await installUnsupportedWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    const body: unknown = route.request().postDataJSON()
    const action = isCardActionRequest(body) ? body.action : "missing"
    actions.push(action)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action,
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "分享" }).click()
  const download = await downloadPromise

  await expect(
    page.getByText("当前浏览器不支持直接分享文件，PNG 会开始下载。")
  ).toBeVisible()
  expect(download.suggestedFilename()).toMatch(
    /^juhua-\d{4}-\d{2}-\d{2}-.+\.png$/
  )
  const png = await inspectDownloadedPng(page)
  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
  expect(actions).toEqual(["share"])
  expect(await getShareAttemptCount(page)).toBe(0)
})

test("falls back to downloading the current PNG when the combined share payload is unsupported", async ({
  page,
}) => {
  const actions: string[] = []

  await installDownloadInspection(page)
  await installCombinedPayloadUnsupportedWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    const body: unknown = route.request().postDataJSON()
    const action = isCardActionRequest(body) ? body.action : "missing"
    actions.push(action)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action,
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "分享" }).click()
  const download = await downloadPromise

  await expect(
    page.getByText("当前浏览器不支持直接分享文件，PNG 会开始下载。")
  ).toBeVisible()
  expect(download.suggestedFilename()).toMatch(
    /^juhua-\d{4}-\d{2}-\d{2}-.+\.png$/
  )
  const png = await inspectDownloadedPng(page)
  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
  expect(actions).toEqual(["share"])
  // canShare rejected the combined payload, so share() must never be invoked.
  expect(await getShareAttemptCount(page)).toBe(0)
})

test("falls back to downloading the current PNG when the Web Share API is missing", async ({
  page,
}) => {
  const actions: string[] = []

  await installDownloadInspection(page)
  await installMissingApiWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    const body: unknown = route.request().postDataJSON()
    const action = isCardActionRequest(body) ? body.action : "missing"
    actions.push(action)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action,
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "分享" }).click()
  const download = await downloadPromise

  await expect(
    page.getByText("当前浏览器不支持直接分享文件，PNG 会开始下载。")
  ).toBeVisible()
  expect(download.suggestedFilename()).toMatch(
    /^juhua-\d{4}-\d{2}-\d{2}-.+\.png$/
  )
  const png = await inspectDownloadedPng(page)
  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
  expect(actions).toEqual(["share"])
})

test("falls back to downloading the current PNG when navigator.canShare throws", async ({
  page,
}) => {
  const actions: string[] = []

  await installDownloadInspection(page)
  await installThrowingCanShareWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    const body: unknown = route.request().postDataJSON()
    const action = isCardActionRequest(body) ? body.action : "missing"
    actions.push(action)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action,
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "分享" }).click()
  const download = await downloadPromise

  await expect(
    page.getByText("当前浏览器不支持直接分享文件，PNG 会开始下载。")
  ).toBeVisible()
  expect(download.suggestedFilename()).toMatch(
    /^juhua-\d{4}-\d{2}-\d{2}-.+\.png$/
  )
  const png = await inspectDownloadedPng(page)
  expect(png.width).toBe(READY_CARD_EXPORT_WIDTH)
  expect(png.height).toBe(READY_CARD_EXPORT_HEIGHT)
  expect(actions).toEqual(["share"])
  expect(await getShareAttemptCount(page)).toBe(0)
})

test("invalid share action success payload blocks Web Share and download fallback", async ({
  page,
}) => {
  await installDownloadInspection(page)
  await installSupportedWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "download",
        status: "allowed",
        message: "wrong action",
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "分享" }).click()
  await expect(
    page.getByText("分享暂时没有完成，当前图文卡片已保留。请稍后再试。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "分享" })).toBeEnabled()
  expect(await getLastDownloadUrl(page)).toBeUndefined()
  expect(await getSharePayloads(page)).toEqual([])
})

test("Web Share rejection keeps the current card and does not auto-download", async ({
  page,
}) => {
  await installDownloadInspection(page)
  await installRejectingWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "share",
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  await page.getByRole("button", { name: "分享" }).click()
  await expect(
    page.getByText("分享暂时没有完成，当前图文卡片已保留。请稍后再试。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "分享" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()
  expect(await getLastDownloadUrl(page)).toBeUndefined()
  expect(await getShareAttemptCount(page)).toBe(1)
})

test("user-cancelled Web Share keeps the current card and shows a calm non-retry message", async ({
  page,
}) => {
  await installDownloadInspection(page)
  await installCancelledWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "share",
        status: "allowed",
        message: "allowed",
      }),
    })
  })

  await page.goto("/")
  const initialSentence = await page
    .getByRole("article", { name: "图文卡片预览" })
    .getByText(/^“.*”$/)
    .textContent()

  await page.getByRole("button", { name: "分享" }).click()
  await expect(page.getByText("已取消分享，当前图文卡片已保留。")).toBeVisible()
  await expect(page.getByRole("button", { name: "分享" })).toBeEnabled()
  await expect(page.getByText(initialSentence ?? "")).toBeVisible()
  expect(await getLastDownloadUrl(page)).toBeUndefined()
  expect(await getShareAttemptCount(page)).toBe(1)
})

test("share limit response blocks Web Share and download fallback", async ({
  page,
}) => {
  await installDownloadInspection(page)
  await installSupportedWebShareInspection(page)
  await page.route("**/api/card-action", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "ready_card_limited",
        message: "这个操作有点频繁了，先让当前图文卡片停留一会儿。",
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "分享" }).click()
  await expect(
    page.getByText("这个操作有点频繁了，先让当前图文卡片停留一会儿。")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "分享" })).toBeEnabled()
  expect(await getLastDownloadUrl(page)).toBeUndefined()
  expect(await getSharePayloads(page)).toEqual([])
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

test("serves a stored generated WebP through the public image route", async ({
  request,
}) => {
  await seedGeneratedIllustrationReadyCard()

  const response = await request.get(generatedIllustrationUrl)
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("image/webp")
  expect(await response.body()).toEqual(generatedIllustrationBytes)

  expect(
    (await request.get("/generated-illustrations/../secret.webp")).status()
  ).toBe(404)
  expect(
    (await request.get("/generated-illustrations/missing.webp")).status()
  ).toBe(404)
})

test("exposes illustrationUrl and renders a real image for stored WebP cards", async ({
  page,
  playwright,
}) => {
  await clearReadyCards()
  await seedGeneratedIllustrationReadyCard()
  const visitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    const card = await getReadyCard(await fetchReadyCard(visitor))

    expect(card).toMatchObject({
      id: "test-generated-card",
      illustrationUrl: generatedIllustrationUrl,
      sceneLabel: "真实 WebP 插画场景",
    })
  } finally {
    await visitor.dispose()
  }

  await clearReadyCards()
  await seedGeneratedIllustrationReadyCard()
  await page.goto("/")

  const image = page.getByRole("img", { name: "真实 WebP 插画场景" })
  await expect(image).toBeVisible()
  await expect(image).toHaveAttribute("src", generatedIllustrationUrl)
  await expect(page.getByText("“有一束光，正在纸上慢慢醒来。”")).toBeVisible()
})

test("does not expose unsafe illustration paths from ready-card rows", async ({
  playwright,
}) => {
  await seedUnsafeIllustrationPathReadyCard()
  const visitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  })

  try {
    const card = await getReadyCard(await fetchReadyCard(visitor))

    expect(card).toMatchObject({
      id: "test-unsafe-card",
      illustrationUrl: null,
      sceneLabel: "不安全插画路径场景",
    })
  } finally {
    await visitor.dispose()
  }
})

test("returns a safe ready_card_not_found payload when no ready cards exist", async ({
  request,
}) => {
  await clearReadyCards()

  const response = await fetchReadyCard(request)
  expect(response.status()).toBe(404)
  const body: unknown = await response.json()
  expect(body).toMatchObject({
    error: "ready_card_not_found",
    message:
      "这会儿还没有准备好的图文卡片。新的图文绑定还在慢慢准备中，请稍后再试。",
  })
  expect(JSON.stringify(body)).not.toMatch(
    /local store|pnpm db:setup|database|sqlite|stack|model|provider|generation/i
  )
})
