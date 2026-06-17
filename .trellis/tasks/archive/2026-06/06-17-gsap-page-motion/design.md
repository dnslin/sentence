# Design: Add GSAP Page Motion

## First-Principles Framing

### Challenge assumptions

- Adding animation does not automatically improve design quality; if motion adds latency, confusion, or visual noise, it reduces product value.
- GSAP does not need to own every visual change; CSS/Tailwind can keep static responsive styling while GSAP owns orchestrated runtime motion.
- A refresh animation must not imply live generation, history, or an independent image pool; the data contract remains one canonical 图文绑定 returned by the API.
- The PNG export contract is stricter than the page presentation contract: export must capture the card article only, not surrounding page motion chrome.

### Bedrock truths

- Browser DOM animation can only run after hydration, so GSAP must stay inside client lifecycle code.
- React can unmount or re-render client components; animations need scoped targeting and cleanup to avoid stale DOM writes.
- Users with reduced-motion preferences can experience discomfort from non-essential movement; state must remain understandable without animation.
- The current card is a canonical sentence/illustration binding; UI must never display an intermediate state that mixes old sentence with new illustration or vice versa.
- PNG export reads the live `QuietGalleryCard` article node; transient transform/opacity applied to that node can affect export if export happens while animation is active.

### Rebuild from ground up

The implementation should add the smallest runtime animation surface that can deliver the chosen “quiet picture-book” feeling:

1. Keep data/state ownership in `HomeCardExperience` unchanged.
2. Add GSAP only to client-side presentation layers that already own the interactive DOM.
3. Scope all selectors to a local wrapper ref and use data attributes for animation targets.
4. Use a timeline for entrance sequencing so header, card, card internals, controls, and announcement area enter as one composed scene.
5. On refresh success, update the card only after a valid API response, then animate the new complete card binding as a single artifact.
6. Disable or neutralize non-essential motion when `prefers-reduced-motion: reduce` matches.
7. Do not animate export-critical state while download/share is pending; existing disabled-state rules already prevent refresh/export concurrency.

### Contrast with convention

A conventional decorative approach might add large parallax layers, looping background movement, or route-wide scroll-triggered effects. That is suboptimal here because the product is a quiet single-card prototype, the homepage has no scroll narrative, and the export boundary makes uncontrolled card transforms risky. The essential difference is treating motion as state clarification and tactile presentation, not spectacle.

### Conclusion

Use GSAP for a scoped, client-only, low-amplitude homepage/card timeline and refresh reveal. Do not expand the product surface or introduce heavy decorative motion.

## Architecture and Boundaries

### Dependencies

- Add `gsap` and `@gsap/react` to runtime dependencies.
- Register `useGSAP` in a client-only module/component before hook use.

### Component boundaries

- `app/home-experience.tsx`
  - Remains a server-compatible component.
  - May add data attributes to header/backdrop/sections for animation targeting.
  - No GSAP imports here unless the file becomes client-side; prefer keeping it server-compatible.

- `app/home-card-experience.tsx`
  - Primary GSAP boundary because it is already a client component.
  - Owns wrapper refs, `useGSAP`, timeline setup, and refresh reveal after `currentCard.id` changes.
  - Keeps refresh/download/share logic unchanged.

- `app/quiet-gallery-card.tsx`
  - Remains presentational and forward-ref compatible.
  - May add stable `data-motion-*` attributes to internal visual regions if needed.
  - Must not include business logic or export-specific alternate rendering.

- `tests/ready-card.spec.ts`
  - Add or adjust browser-visible checks for reduced-motion behavior and ensure existing homepage/export tests still pass.

## Motion Design

### Default-motion mode

- Initial entry:
  - Wrapper fades in from low opacity.
  - Card appears with small `y`, `rotation`, and `scale` offsets, like paper settling on a desk.
  - Illustration mat, sentence block, and controls stagger lightly.
  - Header line can draw/fade in subtly.

- Refresh:
  - Pending state keeps existing `aria-busy` and button disabled behavior.
  - After a valid new `PublicReadyCard` arrives and state updates, reveal the complete new card with a short low-amplitude settle animation.
  - Do not add redundant success copy; the visible card change remains the success feedback.

- Controls:
  - Avoid extra event listeners unless necessary.
  - Prefer CSS hover already present for basic button affordances; if GSAP is used for event-triggered control animation, wrap callbacks with `contextSafe()` and clean up listeners.

### Reduced-motion mode

- Use `gsap.matchMedia()` with a `reduceMotion` condition inside `useGSAP`.
- When reduced motion is active, set final visible states immediately or use duration `0`.
- State must remain visible through existing copy, disabled buttons, `aria-busy`, and live region announcements.

## Data Flow and Contracts

- The refresh API flow remains:
  1. User clicks refresh.
  2. UI sets pending state and announces pending copy.
  3. `/api/ready-card` returns a full `PublicReadyCard` or an error.
  4. On valid success, `currentCard` is replaced atomically.
  5. Motion reveals the new complete article.

- Download/share flow remains unchanged:
  - Server action gate first.
  - Export reads `cardRef.current` and `currentCard`.
  - Existing busy-state rules prevent refresh during export/share.

## Compatibility and SSR

- Do not execute `gsap.*` during server rendering.
- Keep GSAP code inside `useGSAP` or context-safe callbacks in client components.
- Use transform aliases (`x`, `y`, `scale`, `rotation`) and `autoAlpha` rather than raw `transform` strings or layout-heavy properties.
- Avoid animating `width`, `height`, `top`, or `left`.

## Testing Strategy

Requirement-driven scenarios:

1. Happy path: homepage renders a ready card and action controls with default motion enabled.
2. Refresh success: clicking refresh still replaces sentence plus illustration binding atomically.
3. Refresh pending: duplicate requests remain blocked and `aria-busy` remains correct.
4. Error handling: failed/limited/empty-stock refresh keeps current card and announcements.
5. Export continuity: download/share still operate on current card after motion changes.
6. Reduced motion: emulated `prefers-reduced-motion: reduce` neutralizes non-essential transform/transition motion while content remains usable.

Validation commands:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e -- --grep "renders the API-backed ready card|refresh replaces|shows loading transition|downloads the current card|shares the current card|reduced"`
- If grep coverage is insufficient after adding tests, run `pnpm test:e2e`.

## Rollback

- Remove GSAP imports/hook usage and `data-motion-*` attributes.
- Remove `gsap` and `@gsap/react` dependencies if no longer referenced.
- Existing static/Tailwind UI should remain functional because business logic and layout contracts are preserved.
