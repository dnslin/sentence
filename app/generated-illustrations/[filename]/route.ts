import { readFile } from "node:fs/promises"

import { NextResponse } from "next/server"

import { resolveGeneratedIllustrationFilePath } from "@/lib/generation/generated-illustration-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ filename: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params
  const filePath = resolveGeneratedIllustrationFilePath(filename)

  if (!filePath) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const bytes = await readFile(filePath)
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
