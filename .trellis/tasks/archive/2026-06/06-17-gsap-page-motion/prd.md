# Add GSAP page motion

## Goal

Add tasteful GSAP-powered motion to the public homepage card experience so the page feels more intentionally designed while preserving the quiet picture-book tone of 句画.

## User Value

Visitors should feel that the current 图文卡片 is gently presented as a crafted object, not abruptly inserted into a static layout. Motion should clarify the current state during page entry and refresh without changing the product contract.

## Confirmed Facts

- The public homepage is served by `app/page.tsx` and renders `HomeExperience`.
- The card interaction boundary is `app/home-card-experience.tsx`, a client component that owns refresh, download, share, pending state, and live-region announcements.
- The exported visual artifact is only the `QuietGalleryCard` article node from `app/quiet-gallery-card.tsx`; page decoration and controls must stay outside PNG export.
- `QuietGalleryCard` already supports `aria-busy`, `isRefreshing`, real-image/fallback illustration rendering, and reduced-motion Tailwind classes.
- Existing browser tests in `tests/ready-card.spec.ts` cover homepage rendering, refresh replacement, pending states, failure handling, download, share, and PNG visual alignment.
- `package.json` does not currently include `gsap` or `@gsap/react`.
- Frontend guidelines require browser-visible route checks when the route behavior is the contract and require reduced-motion behavior to remain understandable without non-essential motion.
- GSAP React guidance favors `useGSAP()` with a scoped ref and automatic cleanup; animations created after the hook runs must use context-safe callbacks.
- GSAP guidance favors transform aliases (`x`, `y`, `scale`, `rotation`) and timelines for coordinated sequences.
- The selected product direction is “quiet picture-book motion”: paper landing on a desk, gentle stagger between illustration/sentence/actions, and soft refresh page-turn feedback rather than dramatic or scroll-heavy effects.

## Requirements

- Add GSAP motion only where it supports the current public homepage experience: page/card entrance, gentle card presentation, and refresh-state feedback.
- Use the selected “quiet picture-book motion” intensity: subtle, low-amplitude, tactile, and calm.
- Keep the product language truthful: no new claims about accounts, saved history, galleries, posting, generation guarantees, or living-artist style.
- Preserve existing refresh, download, share, rate-limit, empty-stock, and limited-state behavior.
- Preserve the PNG export contract: the exported node must remain the current `QuietGalleryCard` article and must not capture page decorations, controls, or transient action UI.
- Respect `prefers-reduced-motion`; reduced-motion users must get an understandable, non-motion-dependent state.
- Do not add prototype-only or debug controls to the public page.
- Do not introduce server-side GSAP execution or SSR-dependent animation behavior.

## Acceptance Criteria

- [ ] Homepage with a ready card renders the same accessible article, sentence, image/fallback label, and action controls as before.
- [ ] Initial ready-card experience has visible, tasteful “quiet picture-book” motion in default-motion mode without changing layout semantics or product copy.
- [ ] Refresh pending and refresh replacement remain functional: one request at a time, current card preserved on failure/limit/empty-stock, and successful refresh replaces sentence plus illustration binding.
- [ ] Refresh replacement uses a calm transition that never shows a mismatched sentence/illustration binding.
- [ ] Download and share still capture/deliver the current card, not page chrome or a stale/transient card.
- [ ] Reduced-motion mode does not depend on transform animation for comprehension and neutralizes non-essential page/card motion.
- [ ] Empty-stock and limited homepage states remain calm, truthful, and free of fake debug/prototype behavior.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] Relevant browser-visible tests/checks pass for homepage rendering, refresh behavior, download/share export continuity, and reduced-motion handling.

## Out of Scope

- Redesigning the card visual system from scratch.
- Adding scroll-driven sections, galleries, account/history features, or new production routes.
- Changing generation, database, rate-limit, download, or share backend contracts.
- Replacing DOM-to-PNG export with a parallel canvas/layout implementation.
- Adding named living-artist style references.
- Adding dramatic parallax, scroll-triggered storytelling, or heavy background animation in this slice.

## Open Questions

- None blocking planning.
