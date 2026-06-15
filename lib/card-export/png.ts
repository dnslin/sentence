import { toBlob } from "html-to-image"

import type { PublicReadyCard } from "@/lib/cards/public-ready-card"

export const READY_CARD_EXPORT_WIDTH = 1080
export const READY_CARD_EXPORT_HEIGHT = 1350

export type ReadyCardPngExport = {
  blob: Blob
  fileName: string
  width: typeof READY_CARD_EXPORT_WIDTH
  height: typeof READY_CARD_EXPORT_HEIGHT
}

export type ReadyCardExportOptions = {
  now?: Date
}

export class ReadyCardExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReadyCardExportError"
  }
}

export async function exportReadyCardToPng(
  cardNode: HTMLElement,
  card: PublicReadyCard,
  options: ReadyCardExportOptions = {}
): Promise<ReadyCardPngExport> {
  await document.fonts?.ready.catch(() => undefined)

  const blob = await toBlob(cardNode, {
    backgroundColor: "#ffffff",
    cacheBust: true,
    canvasWidth: READY_CARD_EXPORT_WIDTH,
    canvasHeight: READY_CARD_EXPORT_HEIGHT,
    pixelRatio: 1,
    skipAutoScale: true,
  })

  if (!blob) throw new ReadyCardExportError("PNG export failed")

  return {
    blob,
    fileName: buildReadyCardFileName(card, options.now ?? new Date()),
    width: READY_CARD_EXPORT_WIDTH,
    height: READY_CARD_EXPORT_HEIGHT,
  }
}

function buildReadyCardFileName(card: PublicReadyCard, now: Date) {
  const date = now.toISOString().slice(0, 10)
  const safeId = card.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "card"

  return `juhua-${date}-${safeId}.png`
}
