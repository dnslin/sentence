"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { PublicReadyCard } from "@/lib/cards/public-ready-card"

import { QuietGalleryCard } from "./quiet-gallery-card"

type Announcement = {
  text: string
  sequence: number
}

export function HomeCardExperience({ card }: { card: PublicReadyCard }) {
  const [announcement, setAnnouncement] = useState<Announcement>({ text: "", sequence: 0 })

  function announce(text: string) {
    setAnnouncement((current) => ({ text, sequence: current.sequence + 1 }))
  }

  return (
    <>
      <QuietGalleryCard card={card} isTilted={false} />

      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row" aria-label="图文卡片操作">
          <Button
            type="button"
            size="lg"
            className="rounded-full px-5"
            onClick={() => announce("刷新生成会在后续切片接入；现在仍显示这张已准备好的图文卡片。")}
          >
            再来一张
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            onClick={() => announce("PNG 下载会在后续切片接入；现在先保留这张卡片的安静样子。")}
          >
            下载 PNG
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full bg-white/70 px-5"
            onClick={() => announce("分享能力会在后续切片接入；现在没有调用系统分享。")}
          >
            分享
          </Button>
        </div>
        <p className="min-h-6 text-center text-sm text-stone-500" aria-live="polite">
          <span>{announcement.text}</span>
          {announcement.sequence > 0 ? <span className="sr-only"> 第 {announcement.sequence} 次提示</span> : null}
        </p>
      </div>
    </>
  )
}
