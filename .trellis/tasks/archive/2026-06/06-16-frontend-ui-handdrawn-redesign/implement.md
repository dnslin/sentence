# Implement — Paper Desk hand-drawn homepage redesign

## Pre-flight

- [ ] Read `.trellis/spec/frontend/quality-guidelines.md` and `.trellis/spec/frontend/index.md` (done in planning).
- [ ] Confirm baseline green: `pnpm lint`, `pnpm typecheck`, `pnpm build` before edits.

## Ordered checklist

1. Design tokens (`app/globals.css`)
   - [ ] Add Paper Desk CSS variables (paper base, paper sheet tint, card paper, sketched-border color, tinted shadow). Keep existing shadcn token block intact.
   - [ ] Do not change radius scale semantics relied on by `Button`; add new vars rather than mutating `--radius` if a hand-drawn radius is needed.

2. Card surface (`app/quiet-gallery-card.tsx`)
   - [ ] Apply paper texture + hand-drawn border to the article while keeping `grid aspect-[4/5] grid-rows-[3fr_1fr]`, the card clamp, `aria-label`, `aria-busy`, and `data-card`.
   - [ ] Keep the real-image vs CSS-fallback branch and the `dawn|rain|moon` gradients; refine fallback art toward picture-book tone if needed without breaking `role="img"` + `aria-label={sceneLabel}`.
   - [ ] Keep tilt/refresh transitions behind `motion-safe`/`motion-reduce`.

3. Page shell + states (`app/home-experience.tsx`)
   - [ ] Rebuild `main`/`section`/`header` with the Paper Desk desk surface; keep `min-h-svh`, semantic structure, and `home-title` id.
   - [ ] Restyle `HomeEmptyStock` and `HomeLimitedState` to match, preserving the exact heading/body strings the e2e asserts.
   - [ ] Keep page-only desk decoration outside the card article so it is excluded from PNG export.

4. Action row + announcements (`app/home-card-experience.tsx`)
   - [ ] Restyle the action row and announcement paragraph only. Do not change fetch logic, guards, pending logic, button labels, or announcement strings.
   - [ ] Verify buttons keep readable contrast on the new paper tones (adjust `outline`/`bg` utilities, not button variant internals).

5. Font (optional, only if needed)
   - [ ] If a hand-drawn-friendly font is added, self-host via `next/font` in `app/layout.tsx`; otherwise keep current stack. Check package availability before adding anything.

## Validation commands

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e` (or targeted: ready-card spec). Reset e2e DB with `pnpm test:e2e:reset-db` if needed.
- [ ] Browser-observable check at mobile (~375px) and desktop (~1280px): no horizontal overflow, actions usable, card visible, reduced-motion neutralizes transforms.

## Risky files / rollback points

- `app/quiet-gallery-card.tsx` — highest risk: structural changes can break PNG pixel-sampling and image/fallback e2e. Prefer surface-only styling; re-run export tests after edits.
- `app/home-experience.tsx` — empty-stock/limited copy is asserted verbatim; do not alter those strings.
- `app/globals.css` — shared token file; additive changes only, avoid regressing shadcn tokens.
- Rollback: revert the four touched files; no data/API/version migration involved.

## Review gates

- [ ] All contract strings/labels preserved (grep for `再来一张`, `下载 PNG`, `分享`, `图文卡片预览`, empty/limited copy).
- [ ] No prototype/debug controls added to production DOM.
- [ ] No new dependency added without availability check and justification.
- [ ] Reduced-motion and responsive checks pass via browser.
