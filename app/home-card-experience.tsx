"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { RefreshCw, Download, Share2 } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { downloadBlob } from "@/lib/card-export/download"
import { exportReadyCardToPng } from "@/lib/card-export/png"
import {
  canShareReadyCardFile,
  createReadyCardSharePayload,
  isShareCancellation,
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

gsap.registerPlugin(useGSAP)

const prefersReduceMotionQuery = "(prefers-reduced-motion: reduce)"

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
const downloadFailureAnnouncement =
  "PNG 暂时没有准备成功，当前图文卡片已保留。请稍后再试。"
const shareSuccessAnnouncement =
  "已打开系统分享，图文卡片 PNG 已交给浏览器处理。"
const shareFallbackDownloadAnnouncement =
  "当前浏览器不支持直接分享文件，PNG 会开始下载。"
const shareFailureAnnouncement =
  "分享暂时没有完成，当前图文卡片已保留。请稍后再试。"
const shareCancelledAnnouncement = "已取消分享，当前图文卡片已保留。"

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
  const motionScopeRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const previousAnimatedCardIdRef = useRef(card.id)
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

  function settleCardMotionBeforeExport(cardNode: HTMLElement) {
    const scope = motionScopeRef.current
    const animatedCardTargets = scope
      ? gsap.utils.toArray<HTMLElement>(
          "[data-motion-card-illustration], [data-motion-card-sentence]",
          scope
        )
      : []
    const exportTargets = [cardNode, ...animatedCardTargets]

    gsap.killTweensOf(exportTargets)
    gsap.set(exportTargets, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      clearProps: "transform,opacity,visibility",
    })
  }

  useGSAP(
    () => {
      const scope = motionScopeRef.current
      if (!scope) return

      const motionTargets = gsap.utils.selector(scope)
      const cardNode = cardRef.current
      const innerTargets = motionTargets(
        "[data-motion-card-illustration], [data-motion-card-sentence], [data-motion-actions]"
      )
      const ruleTargets = motionTargets("[data-motion-rule]")
      const allTargets = [cardNode, ...innerTargets, ...ruleTargets].filter(
        Boolean
      )

      const media = gsap.matchMedia(scope)
      media.add(
        {
          reduceMotion: prefersReduceMotionQuery,
          defaultMotion: `(not ${prefersReduceMotionQuery})`,
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(allTargets, {
              autoAlpha: 1,
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              clearProps: "transform,opacity,visibility",
            })
            return
          }

          const timeline = gsap.timeline({ defaults: { ease: "power2.out" } })
          timeline
            .from(cardNode, {
              autoAlpha: 0,
              y: 18,
              scale: 0.985,
              rotation: -1.4,
              duration: 0.82,
              clearProps: "transform,opacity,visibility",
            })
            .from(
              innerTargets,
              {
                autoAlpha: 0,
                y: 10,
                duration: 0.52,
                stagger: 0.08,
                clearProps: "transform,opacity,visibility",
              },
              "-=0.48"
            )
            .from(
              ruleTargets,
              {
                autoAlpha: 0,
                scale: 0.72,
                duration: 0.42,
                stagger: 0.06,
                clearProps: "transform,opacity,visibility",
              },
              "-=0.36"
            )
        }
      )

      return () => media.revert()
    },
    { scope: motionScopeRef }
  )

  useGSAP(
    () => {
      const cardNode = cardRef.current
      if (!cardNode) return

      if (previousAnimatedCardIdRef.current === currentCard.id) return
      previousAnimatedCardIdRef.current = currentCard.id

      const media = gsap.matchMedia(cardNode)
      media.add(
        {
          reduceMotion: prefersReduceMotionQuery,
          defaultMotion: `(not ${prefersReduceMotionQuery})`,
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(cardNode, {
              autoAlpha: 1,
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              clearProps: "transform,opacity,visibility",
            })
            return
          }

          gsap.from(cardNode, {
            autoAlpha: 0,
            x: 6,
            y: 8,
            scale: 0.992,
            rotation: 0.8,
            duration: 0.48,
            ease: "power2.out",
            clearProps: "transform,opacity,visibility",
          })
        }
      )

      return () => media.revert()
    },
    { dependencies: [currentCard.id], scope: motionScopeRef }
  )

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
      announce("")
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

      settleCardMotionBeforeExport(cardRef.current)
      const exportedCard = await exportReadyCardToPng(
        cardRef.current,
        currentCard
      )

      if (action === "download") {
        downloadBlob(exportedCard.blob, exportedCard.fileName)
        announce("")
        return
      }

      const sharePayload = createReadyCardSharePayload(exportedCard)

      if (!canShareReadyCardFile(sharePayload)) {
        downloadBlob(exportedCard.blob, exportedCard.fileName)
        announce(shareFallbackDownloadAnnouncement)
        return
      }

      try {
        await shareReadyCardFile(sharePayload)
      } catch (error) {
        // A user dismissing the share sheet (AbortError) is a calm cancel, not
        // a failure; do not fall back to download and do not suggest a retry.
        if (isShareCancellation(error)) {
          announce(shareCancelledAnnouncement)
          return
        }
        throw error
      }

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
    <div
      ref={motionScopeRef}
      data-motion-home-card
      className="flex w-full flex-col items-center gap-4"
    >
      <QuietGalleryCard
        ref={cardRef}
        card={currentCard}
        isRefreshing={isRefreshing}
        isTilted={false}
      />

      <div className="w-full max-w-[min(23.5rem,calc(100vw-2rem))] px-1 sm:max-w-[25rem]">
        <div
          data-motion-rule
          aria-hidden="true"
          className="mx-auto mb-1.5 h-px w-16 bg-[var(--ink-sketch)]/28"
        />
        <div
          data-motion-actions
          className="grid w-full grid-cols-3 items-end gap-2"
          role="group"
          aria-label="图文卡片操作"
        >
          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            className="mx-auto rounded-full bg-transparent text-[var(--ink-deep)] shadow-none hover:bg-[var(--paper-sheet)]/52 hover:text-[var(--ink-soft)] [&_svg]:size-5"
            disabled={isCardBusy}
            aria-label={isRefreshing ? "刷新中" : "再来一张"}
            onClick={refreshCard}
          >
            <RefreshCw aria-hidden="true" strokeWidth={1.7} />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            className="mx-auto rounded-full bg-transparent text-[var(--ink-soft)] shadow-none hover:bg-[var(--paper-sheet)]/52 hover:text-[var(--ink-deep)] [&_svg]:size-5"
            disabled={isCardBusy}
            aria-label={pendingCardAction === "download" ? "准备中" : "下载"}
            onClick={() => void runCardAction("download")}
          >
            <Download aria-hidden="true" strokeWidth={1.7} />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            className="mx-auto rounded-full bg-transparent text-[var(--ink-soft)] shadow-none hover:bg-[var(--paper-sheet)]/52 hover:text-[var(--ink-deep)] [&_svg]:size-5"
            disabled={isCardBusy}
            aria-label={pendingCardAction === "share" ? "确认中" : "分享"}
            onClick={() => void runCardAction("share")}
          >
            <Share2 aria-hidden="true" strokeWidth={1.7} />
          </Button>
        </div>
        <p
          className="mt-4 min-h-6 text-center text-xs leading-6 text-[var(--ink-soft)]/58 sm:text-sm"
          aria-live="polite"
        >
          <span>{announcement.text}</span>
          {announcement.text ? (
            <span className="sr-only"> 第 {announcement.sequence} 次提示</span>
          ) : null}
        </p>
      </div>
    </div>
  )
}
