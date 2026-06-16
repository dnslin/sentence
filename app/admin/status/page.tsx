import { headers } from "next/headers"

import { authorizeAdminStatus } from "@/lib/admin/admin-auth"
import { collectOperationalStatus } from "@/lib/admin/operational-status"
import { createDatabaseClient } from "@/lib/db/client"

import {
  AdminStatusUnauthorizedView,
  AdminStatusView,
} from "./admin-status-view"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readQueryToken(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function AdminStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, headersList] = await Promise.all([searchParams, headers()])
  const auth = authorizeAdminStatus({
    authorizationHeader: headersList.get("authorization"),
    queryToken: readQueryToken(params.token),
  })

  if (!auth.authorized) {
    return <AdminStatusUnauthorizedView />
  }

  const client = createDatabaseClient()

  try {
    const status = await collectOperationalStatus({ client })
    return <AdminStatusView status={status} />
  } finally {
    client.sqlite.close()
  }
}
