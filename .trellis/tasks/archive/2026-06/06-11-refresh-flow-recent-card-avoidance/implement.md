# Implementation Plan

## Preconditions

- Active task: `.trellis/tasks/06-11-refresh-flow-recent-card-avoidance`.
- Do not start implementation until this plan is reviewed and `task.py start` has set status to `in_progress`.
- Before editing, run `trellis-before-dev` for backend/frontend specs if not already loaded in the implementation phase.

## TDD Scenario Map

Each scenario verifies behavior through public API or browser-visible seams, not private repository details.

1. API identity and enough-stock recent avoidance
   - A new API visitor receives a `Set-Cookie` for anonymous identity.
   - With more than 50 ready cards, repeated `GET /api/ready-card` calls for the same visitor never return an ID from the prior 50 responses.
   - A different anonymous visitor starts from the stable first card instead of inheriting the first visitor's window.
2. Homepage/API seam
   - Visiting `/` renders an initial card.
   - Clicking `再来一张` calls `/api/ready-card` and replaces both sentence text and illustration accessible label.
   - The API response after page load does not repeat the initial page card when enough ready cards exist.
3. Loading transition
   - While the refresh request is delayed, the button shows pending copy, duplicate clicks are disabled, and the card remains visible with a calm pending state.
4. Failure recovery
   - If `/api/ready-card` fails, the current card remains visible, the failure is announced, and a later successful retry can replace the card.
5. Existing ready-card contracts
   - The public API still returns `{ card }` for a fresh visitor.
   - No-ready-card behavior still returns `ready_card_not_found` 404.
   - Seed/setup remains idempotent for fresh anonymous visitors.

## Ordered Red-Green-Refactor Checklist

### Cycle 1: API recent-window tracer

- RED: Add/adjust Playwright API test that seeds enough ready cards and calls `/api/ready-card` repeatedly with one request context, asserting no response repeats any of the prior 50 IDs.
- GREEN:
  - Expand deterministic ready-card seed data beyond 50 cards while preserving the original first seed card.
  - Add `ready_card_views` schema and migration.
  - Add anonymous cookie/proxy support for `/api/ready-card`.
  - Add request-context helper and shared selection/recording service.
  - Update `/api/ready-card` to use the shared service.
- REFACTOR: Keep selection code single-purpose and typed; avoid leaking DB rows into API/UI types.

### Cycle 2: Page seam and refresh replacement

- RED: Add browser test that loads `/`, captures sentence and image accessible label, clicks `再来一张`, waits for `/api/ready-card`, and expects both values to change.
- GREEN:
  - Update `app/page.tsx` to await `cookies()`/`headers()` and use the shared selection service.
  - Update `HomeCardExperience` to hold current card state and fetch/validate `/api/ready-card` on refresh.
  - Update truthful homepage copy for refresh.
- REFACTOR: Move public response type guards into `lib/cards/public-ready-card.ts` if needed by both UI/tests.

### Cycle 3: Loading transition

- RED: Add browser test that delays `/api/ready-card` and observes pending button copy/disabled state and visible card pending state.
- GREEN:
  - Add pending state classes/ARIA using existing `QuietGalleryCard` and Tailwind motion-safe/motion-reduce patterns.
  - Prevent duplicate concurrent refreshes.
- REFACTOR: Keep transition props small and semantic (`isRefreshing`/`isTilted`), no animation-specific state machines.

### Cycle 4: Failure recovery

- RED: Add browser test that fulfills `/api/ready-card` with failure, verifies current card remains and error announcement appears, then retries successfully.
- GREEN:
  - Handle non-OK response, invalid JSON, and fetch rejection by retaining current card and announcing failure.
  - Ensure button is re-enabled in `finally`.
- REFACTOR: Consolidate announcement updates; do not duplicate response parsing.

### Cycle 5: Contract preservation and edge cases

- RED: Adjust/add tests for fresh visitor stable first response, different visitor isolation, and no-ready-card 404 if feasible within existing e2e reset flow.
- GREEN:
  - Fill any gaps in route handler fallback and seed idempotency.
- REFACTOR: Remove obsolete placeholder refresh copy and dead test helpers.

## Files Likely to Change

- `app/api/ready-card/route.ts`
- `app/page.tsx`
- `app/home-experience.tsx`
- `app/home-card-experience.tsx`
- `app/quiet-gallery-card.tsx`
- `lib/cards/public-ready-card.ts`
- `lib/cards/ready-card-repository.ts` or a new adjacent ready-card service module
- `lib/cards/seed-ready-card.ts`
- `lib/db/schema.ts`
- `drizzle/*.sql`
- `proxy.ts`
- `tests/ready-card.spec.ts`
- `.trellis/spec/backend/database-guidelines.md` during finish/spec update if new contracts should persist

## Validation Commands

Run after implementation and fixes:

```bash
pnpm db:setup
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected note: Node 22 may emit an ExperimentalWarning for `node:sqlite`; that is acceptable when commands pass.

## Risk and Rollback Points

- Migration risk: keep the new table additive; do not mutate existing `cards`/`sentences` data.
- Cookie/proxy risk: match only `/` and `/api/ready-card` to avoid broad behavior changes.
- Selection risk: if no eligible non-recent card exists, return a ready fallback rather than a false 404.
- UI risk: preserve download/share placeholder behavior; only refresh becomes real.
- Test risk: Playwright request contexts preserve cookies, so isolate visitors explicitly when checking cross-visitor behavior.
