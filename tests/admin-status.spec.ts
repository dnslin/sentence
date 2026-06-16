import { expect, test } from "@playwright/test"

import { isAdminStatusResponse } from "@/lib/admin/admin-status-contract"

// Mirrors playwright.config.ts webServer.env.JUHUA_ADMIN_STATUS_TOKEN.
const adminStatusToken = "e2e-admin-status-token"

test("denies the status page without a valid admin token", async ({ page }) => {
  await page.goto("/admin/status")

  await expect(page.getByTestId("admin-status-unauthorized")).toBeVisible()
  await expect(page.getByText("库存与生成计数")).toHaveCount(0)
})

test("denies the status API without a valid admin token", async ({
  request,
}) => {
  const response = await request.get("/api/admin/status")

  expect(response.status()).toBe(401)
  expect(response.headers()["www-authenticate"]).toBe("Bearer")

  const body = await response.json()
  expect(body).toMatchObject({ error: "admin_status_unauthorized" })
  expect(JSON.stringify(body)).not.toContain("counts")
})

test("denies the status API with a wrong admin token", async ({ request }) => {
  const response = await request.get("/api/admin/status", {
    headers: { authorization: "Bearer wrong-token" },
  })

  expect(response.status()).toBe(401)
})

test("shows operational status on the page with a valid token", async ({
  page,
}) => {
  await page.goto(`/admin/status?token=${adminStatusToken}`)

  await expect(page.getByRole("heading", { name: "运营状态" })).toBeVisible()
  await expect(page.getByTestId("admin-status-count-ready")).toBeVisible()
  await expect(page.getByTestId("admin-status-count-in-progress")).toBeVisible()
  await expect(page.getByTestId("admin-status-count-failed")).toBeVisible()
  await expect(page.getByTestId("admin-status-storage")).toBeVisible()
})

test("returns operational status from the API with a valid token", async ({
  request,
}) => {
  const response = await request.get("/api/admin/status", {
    headers: { authorization: `Bearer ${adminStatusToken}` },
  })

  expect(response.status()).toBe(200)

  const body: unknown = await response.json()
  expect(isAdminStatusResponse(body)).toBe(true)
  if (!isAdminStatusResponse(body)) return

  expect(typeof body.status.counts.ready).toBe("number")
  expect(body.status.storage.database.exists).toBe(true)
  // The operator payload must not leak secrets or absolute filesystem paths.
  expect(JSON.stringify(body)).not.toContain(adminStatusToken)
  expect(JSON.stringify(body.status.storage)).not.toMatch(/[A-Za-z]:[\\/]|\/home\/|\/Users\//)
})
