import {
  resolveAdminStatusToken,
  verifyAdminStatusToken,
} from "@/lib/admin/admin-auth"
import { collectOperationalStatus } from "@/lib/admin/operational-status"
import { createDatabaseClient } from "@/lib/db/client"

import {
  AdminStatusUnauthorizedView,
  AdminStatusView,
} from "./admin-status-view"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readToken(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null
  return value?.trim() || null
}

export default async function AdminStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const auth = verifyAdminStatusToken({
    presentedToken: readToken(params.token),
    configuredToken: resolveAdminStatusToken(),
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
