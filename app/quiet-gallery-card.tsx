import { forwardRef } from "react"

import type { PublicReadyCard } from "@/lib/cards/public-ready-card"
import { cn } from "@/lib/utils"

type QuietGalleryCardProps = {
  card: PublicReadyCard
  isRefreshing?: boolean
  isTilted: boolean
}

export const QuietGalleryCard = forwardRef<HTMLElement, QuietGalleryCardProps>(
  function QuietGalleryCard({ card, isRefreshing = false, isTilted }, ref) {
    return (
      <article
        ref={ref}
        aria-busy={isRefreshing}
        aria-label="图文卡片预览"
        data-card="quiet-gallery"
        className={cn(
          "paper-grain grid aspect-[4/5] w-full max-w-[min(24rem,calc(100vw-2rem))] grid-rows-[3fr_1fr] overflow-hidden rounded-[2.2rem_1.6rem_2.2rem_1.6rem] border-[1.5px] border-[var(--ink-sketch)] bg-[var(--paper-card)] p-3 shadow-[0_24px_70px_rgba(var(--shadow-paper),0.16)] sm:max-w-[26rem] sm:p-4",
          "motion-safe:transition motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none",
          isTilted ? "motion-safe:-rotate-1" : "motion-safe:rotate-0",
          isRefreshing &&
            "opacity-80 motion-safe:scale-[0.99] motion-reduce:opacity-100"
        )}
      >
        {card.illustrationUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.illustrationUrl}
            alt={card.sceneLabel}
            className="h-full w-full rounded-t-[1.6rem] object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={card.sceneLabel}
            className={cn(
              "relative overflow-hidden rounded-t-[1.6rem]",
              card.accent === "dawn" &&
                "bg-[linear-gradient(180deg,#f8e2bd_0%,#edf1df_58%,#d5dfcc_100%)]",
              card.accent === "rain" &&
                "bg-[linear-gradient(180deg,#dfe8e3_0%,#eef0e9_48%,#c9d7d4_100%)]",
              card.accent === "moon" &&
                "bg-[linear-gradient(180deg,#d9dfef_0%,#ece8dd_54%,#c9d0bd_100%)]"
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
        )}
        <div className="paper-grain flex items-center justify-center overflow-hidden rounded-b-[1.6rem] bg-[var(--paper-panel)] px-6 py-5 text-center">
          <p className="line-clamp-3 text-xl leading-9 font-medium text-[var(--ink-soft)] sm:text-2xl sm:leading-10">
            “{card.sentence}”
          </p>
        </div>
      </article>
    )
  }
)
