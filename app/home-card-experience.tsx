"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
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

  async function refreshCard() {
    if (isRefreshing) return

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
    if (pendingCardAction) return

    setPendingCardAction(action)

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

      if (!isCardActionResponse(body))
        throw new Error("invalid action response")

      announce(body.message)
    } catch {
      announce(cardActionFailureAnnouncement)
    } finally {
      setPendingCardAction(null)
    }
  }

  return (
    <>
      <QuietGalleryCard
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
            disabled={isRefreshing}
            onClick={refreshCard}
          >
            {isRefreshing ? "刷新生成中" : "再来一张"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            disabled={pendingCardAction !== null}
            onClick={() => void runCardAction("download")}
          >
            {pendingCardAction === "download" ? "下载确认中" : "下载 PNG"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            disabled={pendingCardAction !== null}
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
