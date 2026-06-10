"use client"

import { useState } from "react"

import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CardMock = {
  id: string
  sentence: string
  sceneLabel: string
  accent: "dawn" | "rain" | "moon"
}

type MockPageState = "ready" | "loading" | "empty" | "error"

const mockCards: CardMock[] = [
  {
    id: "mock-dawn-window",
    sentence: "风停在窗边，像一封没有署名的信。",
    sceneLabel: "晨光里的窗边小路",
    accent: "dawn",
  },
  {
    id: "mock-rain-lane",
    sentence: "雨声很轻，把街角洗成新的颜色。",
    sceneLabel: "细雨中的安静街角",
    accent: "rain",
  },
  {
    id: "mock-moon-hill",
    sentence: "月亮落在山坡上，替夜晚留了一盏灯。",
    sceneLabel: "月光下的远山和小人",
    accent: "moon",
  },
]

const pageStates = ["ready", "loading", "empty", "error"] as const

function normalizePageState(values: string[]): MockPageState {
  if (values.length !== 1) {
    return "ready"
  }

  const [value] = values
  return pageStates.includes(value as MockPageState) ? (value as MockPageState) : "ready"
}

export function HomeExperience() {
  const searchParams = useSearchParams()
  const pageState = normalizePageState(searchParams.getAll("state"))

  if (pageState !== "ready") {
    return <StatePanel state={pageState} />
  }

  return <ReadyExperience />
}

export function HomeExperienceFallback() {
  return <ReadyExperience initialMessage="正在把图文卡片轻轻摆好。" />
}

function ReadyExperience({ initialMessage = "" }: { initialMessage?: string }) {
  const [cardIndex, setCardIndex] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [message, setMessage] = useState(initialMessage)
  const card = mockCards[cardIndex]

  function showNextCard() {
    setCardIndex((current) => (current + 1) % mockCards.length)
    setRefreshKey((current) => current + 1)
    setMessage("已换一张本地 mock 图文卡片。")
  }

  return (
    <main className="flex min-h-svh items-center justify-center overflow-x-hidden bg-[#f7f2ea] px-4 py-8 text-stone-900 sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 sm:gap-8" aria-labelledby="home-title">
        <header className="max-w-2xl space-y-3 text-center">
          <p className="text-xs font-medium tracking-[0.28em] text-stone-500 uppercase">句画</p>
          <h1 id="home-title" className="text-3xl font-semibold tracking-tight sm:text-5xl">
            把随机短句放进一张安静的图文卡片。
          </h1>
          <p className="text-base leading-7 text-stone-600 sm:text-lg">
            先用本地 mock 数据呈现公开体验；刷新、下载与分享会在后续切片接入真实能力。
          </p>
        </header>

        <article
          aria-label="图文卡片预览"
          data-card="quiet-gallery"
          className={cn(
            "grid aspect-[4/5] w-full max-w-[min(24rem,calc(100vw-2rem))] grid-rows-[3fr_1fr] overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-3 shadow-[0_24px_70px_rgba(87,72,52,0.14)] sm:max-w-[26rem] sm:p-4",
            "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none",
            refreshKey % 2 === 1 ? "motion-safe:-rotate-1" : "motion-safe:rotate-0"
          )}
        >
          <div
            role="img"
            aria-label={card.sceneLabel}
            className={cn(
              "relative overflow-hidden rounded-t-[1.5rem]",
              card.accent === "dawn" && "bg-[linear-gradient(180deg,#f8e2bd_0%,#edf1df_58%,#d5dfcc_100%)]",
              card.accent === "rain" && "bg-[linear-gradient(180deg,#dfe8e3_0%,#eef0e9_48%,#c9d7d4_100%)]",
              card.accent === "moon" && "bg-[linear-gradient(180deg,#d9dfef_0%,#ece8dd_54%,#c9d0bd_100%)]"
            )}
          >
            <div className="absolute top-8 left-8 h-16 w-16 rounded-full bg-amber-100/80 blur-sm" />
            <div className="absolute right-8 bottom-10 left-8 h-20 rounded-[50%] bg-white/35" />
            <div className="absolute bottom-12 left-1/2 h-28 w-px -translate-x-1/2 bg-stone-500/35" />
            <div className="absolute bottom-24 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-stone-700/70" />
            <div className="absolute bottom-7 left-1/2 h-9 w-7 -translate-x-1/2 rounded-full bg-stone-600/65" />
            <div className="absolute right-10 bottom-16 h-16 w-10 rounded-full bg-emerald-900/10" />
            <div className="absolute bottom-0 left-0 h-16 w-full bg-gradient-to-t from-white/45 to-transparent" />
          </div>
          <div className="flex items-center justify-center rounded-b-[1.5rem] bg-[#fbf3e6] px-6 py-5 text-center">
            <p className="text-xl leading-9 font-medium text-stone-700 sm:text-2xl sm:leading-10">“{card.sentence}”</p>
          </div>
        </article>

        <div className="flex w-full flex-col items-center gap-3">
          <div className="flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row" aria-label="图文卡片操作">
            <Button type="button" size="lg" className="rounded-full px-5" onClick={showNextCard}>
              再来一张
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-full bg-white/70 px-5"
              onClick={() => setMessage("PNG 下载会在后续切片接入；现在先保留这张卡片的安静样子。")}
            >
              下载 PNG
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-full bg-white/70 px-5"
              onClick={() => setMessage("分享能力会在后续切片接入；现在没有调用系统分享。")}
            >
              分享
            </Button>
          </div>
          <p className="min-h-6 text-center text-sm text-stone-500" aria-live="polite">
            {message}
          </p>
        </div>
      </section>
    </main>
  )
}

function StatePanel({ state }: { state: Exclude<MockPageState, "ready"> }) {
  const copy = {
    loading: {
      title: "正在轻轻取一张图文卡片",
      body: "请稍等，纸面和画面正在安静地靠近。",
    },
    empty: {
      title: "现在没有可用的图文卡片",
      body: "本地 mock 池暂时为空，稍后会补上一张新的安静画面。",
    },
    error: {
      title: "图文卡片暂时没有摆好",
      body: "请稍后再试，当前只是本地 mock 状态，没有连接外部服务。",
    },
  }[state]

  return (
    <main className="flex min-h-svh items-center justify-center overflow-x-hidden bg-[#f7f2ea] px-4 py-8 text-stone-900 sm:px-8">
      <section className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 rounded-[2rem] border border-stone-200 bg-white/70 p-8 text-center shadow-sm" aria-labelledby="state-title">
        <p className="text-xs font-medium tracking-[0.28em] text-stone-500 uppercase">句画</p>
        <h1 id="state-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {copy.title}
        </h1>
        <p className="text-base leading-7 text-stone-600">{copy.body}</p>
      </section>
    </main>
  )
}
