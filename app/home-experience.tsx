import type { PublicReadyCard } from "@/lib/cards/public-ready-card"

import { HomeCardExperience } from "./home-card-experience"

export function HomeExperience({ card }: { card: PublicReadyCard }) {
  return (
    <main className="flex min-h-svh items-center justify-center overflow-x-hidden bg-[#f7f2ea] px-4 py-8 text-stone-900 sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 sm:gap-8" aria-labelledby="home-title">
        <PublicHomeHeader />
        <HomeCardExperience card={card} />
      </section>
    </main>
  )
}

function PublicHomeHeader() {
  return (
    <header className="max-w-2xl space-y-3 text-center">
      <p className="text-xs font-medium tracking-[0.28em] text-stone-500 uppercase">句画</p>
      <h1 id="home-title" className="text-3xl font-semibold tracking-tight sm:text-5xl">
        把随机短句放进一张安静的图文卡片。
      </h1>
      <p className="text-base leading-7 text-stone-600 sm:text-lg">
        先呈现一张已准备好的图文卡片；刷新、下载与分享会在后续切片接入真实能力。
      </p>
    </header>
  )
}
