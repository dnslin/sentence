# Implement — Elegant hand-drawn picture-book album homepage

## Pre-flight

- [x] Read current PRD.
- [x] Read `.trellis/spec/frontend/index.md`.
- [x] Read `.trellis/spec/frontend/quality-guidelines.md`.
- [x] Read `.trellis/spec/frontend/type-safety.md`.
- [x] Inspect current production homepage components and prior archived hand-drawn task.
- [x] Before editing, run `trellis-before-dev` or load equivalent frontend coding guidance for this active task.
- [x] Optionally capture baseline `pnpm lint`, `pnpm typecheck`, `pnpm build` if time permits; otherwise run them after edits and report any pre-existing failures honestly.

## Ordered checklist

1. Design tokens and utilities — `app/globals.css`
   - [x] Add/adjust album-specific CSS variables for elegant paper, ink, muted watercolor accent, and sketch shadows.
   - [x] Keep shadcn token compatibility; do not mutate shared radius/button semantics unnecessarily.
   - [x] Add small reusable utilities only when Tailwind arbitrary classes would become unreadable, e.g. album grain, sketch frame, watercolor wash.

2. Exported card surface — `app/quiet-gallery-card.tsx`
   - [x] Preserve `forwardRef`, `article`, `aspect-[4/5]`, `grid-rows-[3fr_1fr]`, `aria-label`, `aria-busy`, `data-card`, real image branch, fallback branch, and `sceneLabel` accessibility.
   - [x] Upgrade card to an elegant picture-book album page: compact double frame, paper mat, refined sentence panel, controlled shadow.
   - [x] Refine CSS fallback illustration with more hand-drawn/watercolor cues using simple CSS shapes only.
   - [x] Keep transitions behind `motion-safe` and neutral under `motion-reduce`.

3. Page shell and public states — `app/home-experience.tsx`
   - [x] Recompose the homepage as a compact album spread rather than a loose centered card.
   - [x] Add restrained page-only decorations outside the card article, all `aria-hidden`.
   - [x] Preserve `home-title`, semantic structure, and tested empty/limited copy.
   - [x] Ensure desktop has stronger composition; mobile remains single-column and overflow-safe.

4. Action row and announcements — `app/home-card-experience.tsx`
   - [x] Restyle controls as a compact drawing-table tool strip / album action panel.
   - [x] Do not change fetch logic, type guards, pending logic, labels, or announcement strings.
   - [x] Keep all buttons disabled during any pending action as currently implemented.
   - [x] Ensure touch-friendly mobile stacking and visible live-region text.

5. Review for accidental scope expansion
   - [x] No backend/API/database/export-dimension changes.
   - [x] No prototype/debug controls added to production DOM.
   - [x] No new dependency unless explicitly justified and checked.
   - [x] Public copy remains truthful and domain-consistent.

## Validation commands

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] Relevant Playwright ready-card checks or full `pnpm test:e2e`
- [x] Browser responsive check at representative mobile (~375px) and desktop (~1280px)
- [x] Reduced-motion check: non-essential transform/transition behavior does not carry meaning and is neutralized under reduced motion.
- [x] Spec update reviewed and applied: `.trellis/spec/frontend/quality-guidelines.md` now documents that successful refresh/download do not need redundant success copy; visible browser/card changes are the success feedback.

Validation notes:

- Targeted ready-card Playwright checks now assert successful refresh by waiting for the card content to change, not by requiring redundant success copy.
- A temporary Playwright responsive check passed at 375×812 and 1280×900, then the temporary test files were removed.
- `pnpm build` passes with the existing Turbopack NFT tracing warning for `app/generated-illustrations/[filename]/route.ts` -> `lib/generation/generated-illustration-storage.ts`, unrelated to this frontend-only change.

## Risky files / rollback points

- `app/quiet-gallery-card.tsx` — highest risk because it is the PNG export source and e2e compares visible/exported style.
- `app/home-card-experience.tsx` — logic is already tested; avoid edits beyond classes/markup wrappers.
- `app/home-experience.tsx` — empty/limited copy is tested; preserve exact strings.
- `app/globals.css` — shared global CSS; keep additions localized and avoid breaking shadcn tokens.

Rollback: revert touched frontend files. No data or API cleanup needed.

## Review gates before `task.py start`

- [ ] User approves the planning direction: "手绘画册感，不花里胡哨，典雅，紧致".
- [ ] PRD, design, implement, implement.jsonl, and check.jsonl exist and reflect the same scope.
