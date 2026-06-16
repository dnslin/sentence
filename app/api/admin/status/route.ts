import { NextResponse } from "next/server"

import { authorizeAdminStatusRequest } from "@/lib/admin/admin-auth"
import { collectOperationalStatus } from "@/lib/admin/operational-status"
import {
  adminStatusUnauthorizedError,
  type AdminStatusResponse,
  type AdminStatusUnauthorizedResponse,
} from "@/lib/admin/admin-status-contract"
import { createDatabaseClient } from "@/lib/db/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = authorizeAdminStatusRequest({ request })

  if (!auth.authorized) {
    return NextResponse.json<AdminStatusUnauthorizedResponse>(
      {
        error: adminStatusUnauthorizedError,
        message: "需要有效的访问令牌才能查看运营状态。",
      },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      }
    )
  }

  const client = createDatabaseClient()

  try {
    const status = await collectOperationalStatus({ client })
    return NextResponse.json<AdminStatusResponse>({ status })
  } finally {
    client.sqlite.close()
  }
}
