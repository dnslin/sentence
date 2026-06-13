# Implementation Plan: Issue 11 Rate Limiting

## Pre-implementation Gate

- Product decision resolved: placeholder download/share clicks will call a no-op server action endpoint now.
- After planning approval, run `python ./.trellis/scripts/task.py start .trellis/tasks/06-12-issue-11-rate-limiting` before editing product code.
- Load relevant Trellis coding specs via `trellis-before-dev` before implementation.

## TDD Scenario Map

Requirement-driven scenarios to cover incrementally:

1. Refresh allowed below threshold
   - A fresh anonymous context can call `GET /api/ready-card` and receive HTTP `200` with `{ card }`.
2. Refresh blocked at threshold
   - After consuming the configured refresh quota in the current hourly window, the next request receives HTTP `429` and `{ error: "ready_card_limited", message }`.
3. Blocked refresh has no side effect
   - A blocked refresh does not add a new `ready_card_views` row.
4. Refresh reset
   - With an injected/controlled clock or direct service test, advancing beyond the hourly window allows the same context to consume refresh again.
5. Download allowed placeholder
   - A valid `POST /api/card-action` download request below threshold returns an allowed typed response; the browser announces truthful placeholder copy.
6. Download blocked placeholder
   - A download request above threshold returns `429 ready_card_limited`; the browser announces calm limit copy.
7. Download reset
   - Advancing beyond the hourly window allows download again.
8. Share allowed placeholder
   - A valid share request below threshold returns an allowed typed response; the browser announces truthful placeholder copy.
9. Share blocked placeholder
   - A share request above threshold returns `429 ready_card_limited`; the browser announces calm limit copy.
10. Share reset
    - Advancing beyond the hourly window allows share again.
11. Identity safety
    - Limit rows persist hashed context keys, not raw cookie or raw IP values.
12. Concurrency/atomicity
    - Concurrent same-action checks around a low test threshold do not allow more successful consumes than the threshold.

## Ordered Work

### 1. Focused rate-limit service tracer bullet

- Add failing Node test(s) for the service public interface using an isolated SQLite path and injected clock.
- Implement `rate_limit_windows` schema + migration.
- Implement fixed-window `checkAndConsumeRateLimit` for one action until allowed/blocked/reset service tests pass.

### 2. Generalize action config

- Add tests for `refresh`, `download`, and `share` thresholds through the same service interface.
- Introduce literal action config and strict TypeScript unions.
- Add atomic transaction behavior with `BEGIN IMMEDIATE` through the shared DB transaction helper.

### 3. Wire refresh API

- Add/extend API tests for `GET /api/ready-card` allowed and blocked behavior.
- Ensure blocked refresh returns typed `429`, sets `Retry-After`, and does not record `ready_card_views`.
- Preserve existing success and empty-stock behavior.

### 4. Promote public limit response types

- Extend shared API contract/guards for `ready_card_limited`.
- Remove the local refresh limit response type from `HomeCardExperience`.
- Keep exhaustive handling for known error reasons.

### 5. Add card-action endpoint for placeholders

- Add route-level tests for valid download/share allowed, blocked, reset, and invalid action body.
- Implement `POST /api/card-action` with unknown JSON parsing, typed narrowing, and safe public responses.
- Update `proxy.ts` matcher to include `/api/card-action` so anonymous identity is minted/forwarded before route handling.

### 6. Wire browser UI

- Update download/share buttons to call the card-action endpoint.
- Preserve existing placeholder copy on allowed responses.
- Add calm limit copy for blocked responses and retry-oriented copy for route/network failures.
- Ensure buttons avoid duplicate concurrent action calls when practical and do not claim real download/share behavior.

### 7. Browser-visible TDD checks

- Add Playwright route stubs or fixture setup for refresh/download/share limit feedback.
- Verify current card remains visible after refresh limit.
- Verify placeholder actions announce allowed placeholder copy below limit and calm limit copy when blocked.

### 8. Refactor and quality pass

- Remove duplication between refresh/download/share response handling if it improves clarity without hiding simple behavior.
- Keep modules deep: UI calls a tiny action helper; rate-limit math remains in `lib/rate-limit`.
- Check all public copy against domain vocabulary and placeholder truthfulness.

## Validation Commands

Run after implementation:

- `pnpm db:setup`
- Focused Node tests for the rate-limit service/route if added, e.g. `node --import tsx --test node-tests/rate-limit.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

## Risky Files / Rollback Points

- `drizzle/*.sql` and `lib/db/schema.ts`: additive table only; rollback can leave unused table.
- `app/api/ready-card/route.ts`: must limit before card selection to avoid side effects.
- `proxy.ts`: matcher must include any new endpoint that needs anonymous identity.
- `app/home-card-experience.tsx`: preserve existing refresh success/failure behavior and truthful download/share copy.
- Tests may need isolated database setup to avoid consuming quotas across tests.

## Review Gates Before Start

- PRD acceptance criteria are testable.
- Design keeps rate limiting in SQLite and does not introduce external services.
- User approves the placeholder endpoint decision or supplies a different product scope.
