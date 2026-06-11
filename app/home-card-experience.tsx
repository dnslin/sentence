"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  isReadyCardResponse,
  type PublicReadyCard,
} from "@/lib/cards/public-ready-card"

import { QuietGalleryCard } from "./quiet-gallery-card"

type Announcement = {
  text: string
  sequence: number
}

export function HomeCardExperience({ card }: { card: PublicReadyCard }) {
  const [currentCard, setCurrentCard] = useState(card)
  const [isRefreshing, setIsRefreshing] = useState(false)
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
      if (!response.ok) throw new Error("ready-card request failed")

      const body: unknown = await response.json()
      if (!isReadyCardResponse(body))
        throw new Error("ready-card response was invalid")

      setCurrentCard(body.card)
      announce("已刷新生成新的图文卡片。")
    } catch {
      announce("刷新生成失败，当前图文卡片已保留。请稍后再试。")
    } finally {
      setIsRefreshing(false)
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
            onClick={() =>
              announce(
                "PNG 下载会在后续切片接入；现在先保留这张卡片的安静样子。"
              )
            }
          >
            下载 PNG
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            onClick={() =>
              announce("分享能力会在后续切片接入；现在没有调用系统分享。")
            }
          >
            分享
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
