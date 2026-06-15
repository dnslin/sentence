"use client"

import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { downloadBlob } from "@/lib/card-export/download"
import { exportReadyCardToPng } from "@/lib/card-export/png"
import {
  canShareReadyCardFile,
  createReadyCardSharePayload,
  shareReadyCardFile,
} from "@/lib/card-export/share"
import {
  isCardActionResponse,
  isReadyCardErrorResponse,
  isReadyCardLimitErrorResponse,
  isReadyCardResponse,
  type CardActionName,
  type PublicReadyCard,
} from "@/lib/cards/public-ready-card"

import { QuietGalleryCard } from "./quiet-gallery-card"

const refreshEmptyStockAnnouncement =
  "新的图文卡片还在准备中，当前这一张已保留。请稍后再试。"
const refreshFailureAnnouncement =
  "刷新生成暂时没有成功，当前图文卡片已保留。请稍后再试。"
const refreshLimitAnnouncement =
  "刷新生成有点频繁了，先让当前图文卡片停留一会儿。"
const cardActionFailureAnnouncement =
  "这个操作暂时没有成功，当前图文卡片已保留。请稍后再试。"
const cardActionLimitAnnouncement =
  "这个操作有点频繁了，先让当前图文卡片停留一会儿。"
const downloadSuccessAnnouncement =
  "PNG 已准备好，浏览器会开始下载这张图文卡片。"
const downloadFailureAnnouncement =
  "PNG 暂时没有准备成功，当前图文卡片已保留。请稍后再试。"
const shareSuccessAnnouncement =
  "已打开系统分享，图文卡片 PNG 已交给浏览器处理。"
const shareFallbackDownloadAnnouncement =
  "当前浏览器不支持直接分享文件，PNG 会开始下载。"
const shareFailureAnnouncement =
  "分享暂时没有完成，当前图文卡片已保留。请稍后再试。"

type Announcement = {
  text: string
  sequence: number
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ready-card error reason: ${value}`)
}

function getRefreshErrorAnnouncement(body: unknown) {
  if (isReadyCardErrorResponse(body)) {
    switch (body.error) {
      case "ready_card_not_found":
        return refreshEmptyStockAnnouncement
      default:
        return assertNever(body.error)
    }
  }

  if (isReadyCardLimitErrorResponse(body)) return refreshLimitAnnouncement

  return refreshFailureAnnouncement
}

function getCardActionErrorAnnouncement(body: unknown) {
  if (isReadyCardLimitErrorResponse(body)) return cardActionLimitAnnouncement

  return cardActionFailureAnnouncement
}

export function HomeCardExperience({ card }: { card: PublicReadyCard }) {
  const cardRef = useRef<HTMLElement>(null)
  const [currentCard, setCurrentCard] = useState(card)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingCardAction, setPendingCardAction] =
    useState<CardActionName | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement>({
    text: "",
    sequence: 0,
  })

  function announce(text: string) {
    setAnnouncement((current) => ({ text, sequence: current.sequence + 1 }))
  }

  const isCardActionPending = pendingCardAction !== null
  const isCardBusy = isRefreshing || isCardActionPending

  async function refreshCard() {
    if (isCardBusy) return

    setIsRefreshing(true)
    announce("正在刷新生成新的图文卡片。")

    try {
      const response = await fetch("/api/ready-card", { cache: "no-store" })
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        announce(getRefreshErrorAnnouncement(body))
        return
      }

      if (!isReadyCardResponse(body))
        throw new Error("invalid ready-card response")

      setCurrentCard(body.card)
      announce("已刷新生成新的图文卡片。")
    } catch {
      announce(refreshFailureAnnouncement)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function runCardAction(action: CardActionName) {
    if (isCardBusy) return

    setPendingCardAction(action)
    announce(action === "download" ? "PNG 准备中。" : "分享确认中。")

    try {
      const response = await fetch("/api/card-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const body: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        announce(getCardActionErrorAnnouncement(body))
        return
      }

      if (!isCardActionResponse(body) || body.action !== action)
        throw new Error("invalid action response")

      if (!cardRef.current) throw new Error("missing card export node")

      const exportedCard = await exportReadyCardToPng(
        cardRef.current,
        currentCard
      )

      if (action === "download") {
        downloadBlob(exportedCard.blob, exportedCard.fileName)
        announce(downloadSuccessAnnouncement)
        return
      }

      const sharePayload = createReadyCardSharePayload(exportedCard)

      if (!canShareReadyCardFile(sharePayload)) {
        downloadBlob(exportedCard.blob, exportedCard.fileName)
        announce(shareFallbackDownloadAnnouncement)
        return
      }

      await shareReadyCardFile(sharePayload)
      announce(shareSuccessAnnouncement)
    } catch {
      announce(
        action === "download"
          ? downloadFailureAnnouncement
          : shareFailureAnnouncement
      )
    } finally {
      setPendingCardAction(null)
    }
  }

  return (
    <>
      <QuietGalleryCard
        ref={cardRef}
        card={currentCard}
        isRefreshing={isRefreshing}
        isTilted={false}
      />

      <div className="flex w-full flex-col items-center gap-3">
        <div
          className="flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row"
          aria-label="图文卡片操作"
        >
          <Button
            type="button"
            size="lg"
            className="rounded-full px-5"
            disabled={isCardBusy}
            onClick={refreshCard}
          >
            {isRefreshing ? "刷新生成中" : "再来一张"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            disabled={isCardBusy}
            onClick={() => void runCardAction("download")}
          >
            {pendingCardAction === "download" ? "PNG 准备中" : "下载 PNG"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            disabled={isCardBusy}
            onClick={() => void runCardAction("share")}
          >
            {pendingCardAction === "share" ? "分享确认中" : "分享"}
          </Button>
        </div>
        <p
          className="min-h-6 text-center text-sm text-stone-500"
          aria-live="polite"
        >
          <span>{announcement.text}</span>
          {announcement.sequence > 0 ? (
            <span className="sr-only"> 第 {announcement.sequence} 次提示</span>
          ) : null}
        </p>
      </div>
    </>
  )
}
