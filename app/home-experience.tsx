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
    <main className="album-wash paper-grain relative flex min-h-svh items-center justify-center overflow-x-hidden px-4 py-6 text-[var(--ink-soft)] sm:px-6 sm:py-8 lg:px-12">
      <DeskBackdrop />
      <section
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-3"
        aria-labelledby="home-title"
      >
        {card ? (
          <>
            <PublicHomeHeader />
            <HomeCardExperience card={card} />
          </>
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
      <div className="absolute top-[10%] left-[16%] hidden h-28 w-40 rotate-[-7deg] rounded-[1.4rem_1rem_1.2rem_1rem] border border-[var(--ink-sketch)]/20 bg-[var(--paper-sheet)]/60 shadow-[0_18px_45px_rgba(var(--shadow-paper),0.07)] lg:block" />
      <div className="absolute right-[17%] bottom-[13%] hidden h-36 w-28 rotate-[6deg] rounded-[1rem_1.5rem_1.1rem_1.4rem] border border-[var(--ink-sketch)]/18 bg-[var(--paper-sheet)]/55 shadow-[0_18px_48px_rgba(var(--shadow-paper),0.07)] lg:block" />
      <div className="absolute top-1/2 left-1/2 hidden h-[36rem] w-[25rem] -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] rounded-[2rem_1.4rem_2.2rem_1.6rem] bg-[var(--paper-sheet)]/72 shadow-[0_30px_80px_rgba(var(--shadow-paper),0.09)] lg:block" />
      <div className="absolute top-1/2 left-1/2 hidden h-[34rem] w-[24rem] -translate-x-[47%] -translate-y-[48%] rotate-[2deg] rounded-[1.6rem_2rem_1.4rem_2.1rem] border border-[var(--ink-sketch)]/16 bg-[var(--paper-mat)]/56 shadow-[0_22px_60px_rgba(var(--shadow-paper),0.07)] lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,rgba(var(--shadow-paper),0.08),transparent)]" />
    </div>
  )
}

function HomeEmptyStock() {
  return (
    <section
      className="paper-grain sketch-edge w-full max-w-2xl bg-[var(--paper-sheet)] px-6 py-8 text-center shadow-[0_22px_54px_rgba(var(--shadow-paper),0.13)] sm:px-10 sm:py-10 lg:max-w-xl"
      aria-labelledby="home-empty-title"
    >
      <div className="relative z-10">
        <p className="pencil-rule inline-block pb-2 text-xs font-medium tracking-[0.24em] text-[var(--ink-sketch)] uppercase">
          句画
        </p>
        <h1 id="home-title" className="sr-only">
          一句话，一幅画。
        </h1>
        <h2
          id="home-empty-title"
          className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink-deep)] sm:text-3xl"
        >
          这会儿还没有准备好的图文卡片。
        </h2>
        <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]/80 sm:text-lg">
          新的图文绑定还在慢慢准备中。请稍后再来看看，我们不会让你等待现场生成。
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]/64">
          图文卡片会从已经准备好的图文绑定中呈现；现在先安静等新的卡片准备好。
        </p>
      </div>
    </section>
  )
}

function HomeLimitedState() {
  return (
    <section
      className="paper-grain sketch-edge w-full max-w-2xl bg-[var(--paper-sheet)] px-6 py-8 text-center shadow-[0_22px_54px_rgba(var(--shadow-paper),0.13)] sm:px-10 sm:py-10 lg:max-w-xl"
      aria-labelledby="home-limited-title"
    >
      <div className="relative z-10">
        <p className="pencil-rule inline-block pb-2 text-xs font-medium tracking-[0.24em] text-[var(--ink-sketch)] uppercase">
          句画
        </p>
        <h1 id="home-title" className="sr-only">
          一句话，一幅画。
        </h1>
        <h2
          id="home-limited-title"
          className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ink-deep)] sm:text-3xl"
        >
          刷新生成有点频繁了。
        </h2>
        <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]/80 sm:text-lg">
          先让当前节奏安静一会儿，稍后再回来继续看新的图文卡片。
        </p>
      </div>
    </section>
  )
}

function PublicHomeHeader() {
  return (
    <header className="w-full max-w-[25rem] self-center">
      <div className="flex items-end justify-between px-1 text-[var(--ink-deep)]/82">
        <h1
          id="home-title"
          className="text-xl leading-none font-semibold tracking-[0.22em]"
        >
          句画
        </h1>
        <span
          aria-hidden="true"
          className="mb-0.5 h-px flex-1 bg-[var(--ink-sketch)]/34"
        />
        <p className="ml-3 text-[0.62rem] tracking-[0.24em] text-[var(--ink-sketch)] uppercase">
          Juhua
        </p>
      </div>
      <p className="sr-only">一句话，一幅画。</p>
    </header>
  )
}
