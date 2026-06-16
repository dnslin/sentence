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
    <main className="paper-grain relative flex min-h-svh items-center justify-center overflow-x-hidden bg-[var(--paper-desk)] px-4 py-8 text-[var(--ink-soft)] sm:px-8 lg:px-12">
      <DeskBackdrop />
      <section
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-6 sm:gap-8"
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

// Page-only desk decoration. It sits behind the card and is never part of the
// exported PNG, which captures only the QuietGalleryCard article node.
function DeskBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 hidden h-[34rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-[1.4rem] bg-[var(--paper-sheet)] shadow-[0_30px_80px_rgba(var(--shadow-paper),0.10)] lg:block" />
      <div className="absolute top-1/2 left-1/2 hidden h-[34rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rotate-[3deg] rounded-[1.4rem] bg-[var(--paper-sheet)] shadow-[0_30px_80px_rgba(var(--shadow-paper),0.10)] lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,rgba(var(--shadow-paper),0.06),transparent)]" />
    </div>
  )
}

function HomeEmptyStock() {
  return (
    <section
      className="paper-grain w-full max-w-2xl rounded-[2rem_1.4rem_2rem_1.4rem] border-[1.5px] border-[var(--ink-sketch)] bg-[var(--paper-sheet)] px-6 py-8 text-center shadow-[0_24px_70px_rgba(var(--shadow-paper),0.12)] sm:px-10 sm:py-10"
      aria-labelledby="home-empty-title"
    >
      <p className="text-xs font-medium tracking-[0.24em] text-[var(--ink-sketch)] uppercase">
        图文卡片准备中
      </p>
      <h2
        id="home-empty-title"
        className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink-soft)] sm:text-3xl"
      >
        这会儿还没有准备好的图文卡片。
      </h2>
      <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]/80 sm:text-lg">
        新的图文绑定还在慢慢准备中。请稍后再来看看，我们不会让你等待现场生成。
      </p>
    </section>
  )
}

function HomeLimitedState() {
  return (
    <section
      className="paper-grain w-full max-w-2xl rounded-[2rem_1.4rem_2rem_1.4rem] border-[1.5px] border-[var(--ink-sketch)] bg-[var(--paper-sheet)] px-6 py-8 text-center shadow-[0_24px_70px_rgba(var(--shadow-paper),0.12)] sm:px-10 sm:py-10"
      aria-labelledby="home-limited-title"
    >
      <p className="text-xs font-medium tracking-[0.24em] text-[var(--ink-sketch)] uppercase">
        图文卡片先停一停
      </p>
      <h2
        id="home-limited-title"
        className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink-soft)] sm:text-3xl"
      >
        刷新生成有点频繁了。
      </h2>
      <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]/80 sm:text-lg">
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
  // Empty-stock and limited descriptions are tested by e2e; ready-card state
  // intentionally omits the description for a cleaner visual.
  const description = hasReadyCard
    ? null
    : isLimited
      ? "图文卡片已经看得有点频繁；先安静停一停，稍后再继续刷新生成。"
      : "图文卡片会从已经准备好的图文绑定中呈现；现在先安静等新的卡片准备好。"

  return (
    <header className="max-w-2xl space-y-2 text-center">
      <h1
        id="home-title"
        className="text-2xl font-semibold tracking-tight text-[var(--ink-soft)] sm:text-4xl"
      >
        一句话，一幅画。
      </h1>
      {description ? (
        <p className="text-sm leading-7 text-[var(--ink-soft)]/70 sm:text-base">
          {description}
        </p>
      ) : null}
    </header>
  )
}
