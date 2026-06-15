import type { PublicReadyCard } from "@/lib/cards/public-ready-card"

import { HomeCardExperience } from "./home-card-experience"

export function HomeExperience({
  card,
  isLimited = false,
}: {
  card: PublicReadyCard | null
  isLimited?: boolean
}) {
  return (
    <main className="flex min-h-svh items-center justify-center overflow-x-hidden bg-[#f7f2ea] px-4 py-8 text-stone-900 sm:px-8 lg:px-12">
      <section
        className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 sm:gap-8"
        aria-labelledby="home-title"
      >
        <PublicHomeHeader hasReadyCard={card !== null} isLimited={isLimited} />
        {card ? (
          <HomeCardExperience card={card} />
        ) : isLimited ? (
          <HomeLimitedState />
        ) : (
          <HomeEmptyStock />
        )}
      </section>
    </main>
  )
}

function HomeEmptyStock() {
  return (
    <section
      className="w-full max-w-2xl rounded-[2rem] border border-stone-200/80 bg-white/70 px-6 py-8 text-center shadow-sm shadow-stone-200/60 sm:px-10 sm:py-10"
      aria-labelledby="home-empty-title"
    >
      <p className="text-xs font-medium tracking-[0.24em] text-stone-400 uppercase">
        图文卡片准备中
      </p>
      <h2
        id="home-empty-title"
        className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
      >
        这会儿还没有准备好的图文卡片。
      </h2>
      <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg">
        新的图文绑定还在慢慢准备中。请稍后再来看看，我们不会让你等待现场生成。
      </p>
    </section>
  )
}

function HomeLimitedState() {
  return (
    <section
      className="w-full max-w-2xl rounded-[2rem] border border-stone-200/80 bg-white/70 px-6 py-8 text-center shadow-sm shadow-stone-200/60 sm:px-10 sm:py-10"
      aria-labelledby="home-limited-title"
    >
      <p className="text-xs font-medium tracking-[0.24em] text-stone-400 uppercase">
        图文卡片先停一停
      </p>
      <h2
        id="home-limited-title"
        className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
      >
        刷新生成有点频繁了。
      </h2>
      <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg">
        先让当前节奏安静一会儿，稍后再回来继续看新的图文卡片。
      </p>
    </section>
  )
}

function PublicHomeHeader({
  hasReadyCard,
  isLimited,
}: {
  hasReadyCard: boolean
  isLimited: boolean
}) {
  const description = hasReadyCard
    ? "先呈现一张已准备好的图文卡片；再来一张会刷新生成新的图文绑定，下载 PNG 会导出当前卡片，分享会在后续切片接入真实能力。"
    : isLimited
      ? "图文卡片已经看得有点频繁；先安静停一停，稍后再继续刷新生成。"
      : "图文卡片会从已经准备好的图文绑定中呈现；现在先安静等新的卡片准备好。"

  return (
    <header className="max-w-2xl space-y-3 text-center">
      <p className="text-xs font-medium tracking-[0.28em] text-stone-500 uppercase">
        句画
      </p>
      <h1
        id="home-title"
        className="text-3xl font-semibold tracking-tight sm:text-5xl"
      >
        把随机短句放进一张安静的图文卡片。
      </h1>
      <p className="text-base leading-7 text-stone-600 sm:text-lg">
        {description}
      </p>
    </header>
  )
}
