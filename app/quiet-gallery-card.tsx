import { forwardRef } from "react"

import type { PublicReadyCard } from "@/lib/cards/public-ready-card"
import { cn } from "@/lib/utils"

type QuietGalleryCardProps = {
  card: PublicReadyCard
  isRefreshing?: boolean
  isTilted: boolean
}

const sentenceBreakPunctuation = new Set(["，", "。", "、", "；", "：", "？", "！"])
const maxSentenceLines = 3

function getFallbackLineCount(length: number) {
  if (length <= 10) return 1
  if (length <= 20) return 2
  return maxSentenceLines
}

function splitSentenceByPunctuation(sentence: string) {
  const clauses: string[] = []
  let current = ""

  for (const character of Array.from(sentence.trim())) {
    current += character

    if (sentenceBreakPunctuation.has(character)) {
      clauses.push(current)
      current = ""
    }
  }

  if (current) clauses.push(current)

  return clauses.filter((clause) => clause.length > 0)
}

function groupClausesIntoLines(clauses: string[]) {
  const lineCount = Math.min(clauses.length, maxSentenceLines)
  if (lineCount <= 1) return clauses

  const targetLength =
    clauses.reduce((total, clause) => total + clause.length, 0) / lineCount
  let bestLines: string[] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  function scoreLines(lines: string[]) {
    if (lines.some((line) => line.length < 3)) return Number.POSITIVE_INFINITY

    return lines.reduce((score, line, index) => {
      const widowPenalty = index === lines.length - 1 && line.length < 4 ? 12 : 0
      return score + (line.length - targetLength) ** 2 + widowPenalty
    }, 0)
  }

  function chooseLines(start: number, lines: string[]) {
    const remainingLines = lineCount - lines.length
    const remainingClauses = clauses.length - start

    if (remainingLines === 1) {
      const candidate = [...lines, clauses.slice(start).join("")]
      const score = scoreLines(candidate)
      if (score < bestScore) {
        bestScore = score
        bestLines = candidate
      }
      return
    }

    for (
      let end = start + 1;
      end <= clauses.length - remainingLines + 1;
      end += 1
    ) {
      if (remainingClauses < remainingLines) return
      chooseLines(end, [...lines, clauses.slice(start, end).join("")])
    }
  }

  chooseLines(0, [])

  return bestLines
}

function getBalancedFallbackLines(sentence: string) {
  const characters = Array.from(sentence.trim())
  const lineCount = getFallbackLineCount(characters.length)
  const baseLength = Math.floor(characters.length / lineCount)
  const extra = characters.length % lineCount
  const lines: string[] = []
  let offset = 0

  for (let index = 0; index < lineCount; index += 1) {
    const length = baseLength + (index < extra ? 1 : 0)
    lines.push(characters.slice(offset, offset + length).join(""))
    offset += length
  }

  for (let index = lines.length - 1; index > 0; index -= 1) {
    while (lines[index].length < 3 && lines[index - 1].length > 4) {
      lines[index] = lines[index - 1].slice(-1) + lines[index]
      lines[index - 1] = lines[index - 1].slice(0, -1)
    }
  }

  return lines.filter(Boolean)
}

function balanceSentenceLines(sentence: string) {
  const clauses = splitSentenceByPunctuation(sentence)
  const hasSemanticBreak = clauses.length > 1

  if (hasSemanticBreak) {
    const semanticLines = groupClausesIntoLines(clauses)
    if (semanticLines) return semanticLines
  }

  return getBalancedFallbackLines(sentence)
}

function getSentenceClassName(lineCount: number) {
  if (lineCount === 1) {
    return "text-[1.55rem] leading-[2.45rem] sm:text-[1.75rem] sm:leading-[2.75rem]"
  }

  if (lineCount === 2) {
    return "text-[1.28rem] leading-[2.05rem] sm:text-[1.48rem] sm:leading-[2.35rem]"
  }

  return "text-[1.06rem] leading-[1.72rem] sm:text-[1.18rem] sm:leading-[1.92rem]"
}

export const QuietGalleryCard = forwardRef<HTMLElement, QuietGalleryCardProps>(
  function QuietGalleryCard({ card, isRefreshing = false, isTilted }, ref) {
    const sentenceLines = balanceSentenceLines(card.sentence)
    const sentenceClassName = getSentenceClassName(sentenceLines.length)
    return (
      <article
        ref={ref}
        aria-busy={isRefreshing}
        aria-label="图文卡片预览"
        data-card="quiet-gallery"
        className={cn(
          "paper-grain relative grid aspect-[4/5] w-full max-w-[min(23.5rem,calc(100vw-2rem))] grid-rows-[minmax(0,3fr)_minmax(5.25rem,auto)] overflow-hidden rounded-[2rem_1.45rem_2.15rem_1.55rem] bg-[var(--paper-card)] p-4 shadow-[0_20px_50px_rgba(var(--shadow-paper),0.16),0_1px_0_rgba(255,255,255,0.7)_inset] sm:max-w-[25rem] sm:grid-rows-[minmax(0,3fr)_minmax(7.25rem,auto)] sm:p-5",
          "motion-safe:transition motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none",
          isTilted ? "motion-safe:-rotate-1" : "motion-safe:rotate-0",
          isRefreshing &&
            "opacity-80 motion-safe:scale-[0.99] motion-reduce:opacity-100"
        )}
      >
        <span
          aria-hidden="true"
          className="absolute top-5 left-5 z-20 h-10 w-px rotate-[-4deg] bg-[var(--ink-sketch)]/24"
        />
        <span
          aria-hidden="true"
          className="absolute top-5 right-5 z-20 h-px w-10 rotate-[3deg] bg-[var(--ink-sketch)]/22"
        />
        <div className="relative z-10 overflow-hidden rounded-[1.55rem_1.15rem_1.45rem_1.2rem] bg-[var(--paper-mat)] p-2 shadow-[0_14px_30px_rgba(var(--shadow-paper),0.10),inset_0_0_0_1px_rgba(255,255,255,0.62)]">
          {card.illustrationUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.illustrationUrl}
              alt={card.sceneLabel}
              className="h-full w-full rounded-[1.2rem_0.9rem_1.15rem_0.95rem] object-cover shadow-[0_10px_24px_rgba(var(--shadow-paper),0.10)]"
            />
          ) : (
            <div
              role="img"
              aria-label={card.sceneLabel}
              className={cn(
                "relative h-full overflow-hidden rounded-[1.2rem_0.9rem_1.15rem_0.95rem] shadow-[0_10px_24px_rgba(var(--shadow-paper),0.08)_inset]",
                card.accent === "dawn" &&
                  "bg-[linear-gradient(180deg,#f6ddb2_0%,#eff0d8_54%,#d9e1c7_100%)]",
                card.accent === "rain" &&
                  "bg-[linear-gradient(180deg,#dce8e4_0%,#eef1e8_50%,#c7d8d0_100%)]",
                card.accent === "moon" &&
                  "bg-[linear-gradient(180deg,#d9deed_0%,#ece7da_54%,#cad3bd_100%)]"
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,245,206,0.78),transparent_20%),radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.38),transparent_22%),linear-gradient(110deg,rgba(255,255,255,0.18),transparent_48%)]" />
              <div className="absolute right-8 bottom-12 left-8 h-24 rounded-[50%] bg-white/30 blur-[1px]" />
              <div className="absolute right-10 bottom-16 h-20 w-12 rounded-[55%_45%_50%_48%] border border-emerald-950/10 bg-[var(--watercolor-sage)]/18" />
              <div className="absolute bottom-16 left-[23%] h-14 w-9 rounded-[50%_45%_45%_50%] border border-emerald-950/10 bg-[var(--watercolor-sage)]/14" />
              <div className="absolute bottom-0 left-0 h-20 w-full bg-gradient-to-t from-white/48 to-transparent" />
              <div className="absolute bottom-[4.2rem] left-1/2 h-24 w-px -translate-x-1/2 rotate-[1deg] bg-stone-600/35" />
              <div className="absolute bottom-[7.35rem] left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-stone-700/70 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]" />
              <div className="absolute bottom-9 left-1/2 h-9 w-7 -translate-x-1/2 rounded-[55%_45%_50%_45%] bg-stone-600/65" />
              <div className="absolute bottom-[6.9rem] left-[calc(50%_-_1.35rem)] h-px w-6 rotate-[-16deg] bg-stone-600/35" />
              <div className="absolute bottom-[6.7rem] left-1/2 h-px w-7 rotate-[18deg] bg-stone-600/35" />
              <div className="absolute right-6 bottom-6 left-6 h-px bg-stone-700/20" />
            </div>
          )}
        </div>
        <div className="relative z-10 flex items-center justify-center overflow-hidden px-5 pt-4 pb-2 text-center">
          <span
            aria-hidden="true"
            className="absolute top-3 left-1/2 h-px w-14 -translate-x-1/2 bg-[var(--ink-sketch)]/38"
          />
          <p
            className={cn(
              "font-medium tracking-[0.03em] text-[var(--ink-deep)]",
              sentenceClassName
            )}
          >
            {sentenceLines.map((line, index) => {
              const isFirstLine = index === 0
              const isLastLine = index === sentenceLines.length - 1

              return (
                <span key={`${line}-${index}`} className="block text-pretty">
                  {isFirstLine ? "“" : ""}
                  {line}
                  {isLastLine ? "”" : ""}
                </span>
              )
            })}
          </p>
        </div>
      </article>
    )
  }
)
