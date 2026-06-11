# Add refresh flow with recent-card avoidance and anonymous identity

## Goal

Implement GitHub issue #5: turn the public `再来一张` action from placeholder copy into a real `刷新生成` flow that replaces the current ready 图文卡片 with another ready 图文卡片 while avoiding the visitor's recent 50 cards when enough ready cards exist.

## User Value

A visitor can keep refreshing the current visit without creating an account and receive a visibly different 图文卡片, with calm feedback during loading and a clear recovery path if refresh fails.

## Confirmed Facts

- Source issue: GitHub issue #5, open, part of epic #1, blocked by #4.
- GitHub issue #4 is closed, so the SQLite/Drizzle ready-card API prerequisite is available.
- Current stack is Next.js 16.2.6, React 19, TypeScript strict mode, Tailwind v4, shadcn UI, Playwright e2e.
- Current `/api/ready-card` returns `{ card: PublicReadyCard }` from SQLite through `getOneReadyCard`, with `404 { error: "ready_card_not_found" }` when no card exists.
- Current `/` loads one ready card directly in `app/page.tsx`, then renders `HomeExperience -> HomeCardExperience -> QuietGalleryCard`.
- Current `再来一张` only announces placeholder copy and does not request the API.
- Current seed contains only one ready card; recent-50 behavior requires enough deterministic ready cards in test/dev seed data.
- Product vocabulary and constraints come from `CONTEXT.md`: `刷新生成` replaces both the 随机短句 and its 图文绑定 during the visit, without accounts, saved history, posting, or collections.
- Accepted ADRs require a pregenerated ready-card pool, SQLite WAL via Drizzle for metadata/status/rate-limit-like state, and no independent gallery/image-pool semantics.
- Next.js 16 request APIs are async for `cookies()`/`headers()`; request interception is documented via `proxy.ts`.

## Requirements

- The public `再来一张` button must request a new ready 图文卡片 from the server through the public ready-card API.
- The returned card must replace the current sentence and the visible illustration binding, represented in the current UI by the card's `sceneLabel`/accent-backed illustration area.
- The homepage initial ready card and API refresh responses must use the same recent-card selection path so the first card seen on the page is part of the visitor's recent window.
- Recent-card avoidance must use anonymous browser state plus server-side request context; it must not require accounts or expose user-managed history.
- When there are more than 50 ready cards, a visitor must not receive any card from their most recent 50 served cards.
- When there are no eligible cards outside the recent window but ready cards exist, the server may gracefully fall back to returning a ready card rather than failing.
- When no ready cards exist, the API must keep returning the existing `ready_card_not_found` 404 shape.
- The UI must show a calm loading transition while refresh is pending and prevent duplicate concurrent refreshes.
- The UI must recover gracefully from refresh failure: keep the current card, re-enable refresh, and announce a useful error without claiming the card changed.
- Public copy must become truthful for refresh while still describing download/share as future placeholder capabilities.
- TypeScript must remain strict: no `any`, no duplicated public ready-card response types in UI, and untrusted API JSON must be narrowed before use.

## Acceptance Criteria

- [ ] Clicking `再来一张` sends a request to `/api/ready-card`.
- [ ] A successful refresh replaces both the displayed sentence and the displayed illustration accessible label.
- [ ] The homepage-rendered initial card is recorded in the same anonymous recent-card window used by later API refreshes.
- [ ] The API sets or receives an anonymous cookie and combines it with request IP/header context to select and record served cards without storing raw cookie values or raw IP addresses.
- [ ] With enough ready cards seeded, one visitor receives no card that appears in their prior 50 served cards.
- [ ] A different anonymous visitor is not forced to inherit the first visitor's recent-card window.
- [ ] If ready cards exist but all are in the recent window, the API returns a ready card instead of a false empty-stock error.
- [ ] If no ready cards exist, `/api/ready-card` still returns the existing `ready_card_not_found` 404 response.
- [ ] Refresh loading state is visible through public UI, uses reduced-motion-safe styling, and disables duplicate clicks.
- [ ] Refresh failure leaves the current card visible, announces failure, and allows a later retry.
- [ ] Playwright tests cover API recent-card avoidance, cookie identity behavior, homepage refresh replacement, loading transition, and failure recovery through public API/browser behavior.
- [ ] `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

## Out of Scope

- User accounts, login, saved card history, collections, posting, or cross-device identity.
- Real Hitokoto fetching, real image generation, local WebP public image URLs, pool worker replenishment, rate limiting, download PNG, or Web Share implementation.
- Named living-artist styles or independent gallery/random image-pool behavior.
- Product analytics dashboards or admin status pages.

## Planning Assumptions

- Use a session-scoped anonymous cookie by default. This matches `刷新生成` as current-visit behavior and minimizes persistent tracking. If the product later needs cross-visit repeat avoidance, a later slice can add an explicit max age and retention policy.
- Seed enough deterministic ready cards for dev/test behavior, while keeping the same public API shape and the original seed card as the first card for compatibility.

## Open Questions

- None blocking implementation. The session-scoped cookie assumption is the recommended default unless the user explicitly asks for cross-visit repeat avoidance.
