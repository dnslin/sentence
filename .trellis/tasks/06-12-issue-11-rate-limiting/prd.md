# [Slice 10] Add rate limiting for refresh and download/share actions

## Goal

Add anonymous, persisted rate limiting for public card actions so 句画 can keep refresh/download/share usage bounded on a single-machine deployment while giving visitors calm, non-technical feedback when an hourly limit is reached.

## User Value

Visitors can keep exploring 图文卡片 without accounts while the service protects the pregenerated ready pool and public action endpoints from one anonymous context consuming excessive capacity.

## Source Requirement

GitHub issue #11: `[Slice 10] Add rate limiting for refresh and download/share actions`.

Issue acceptance requires:

- Refresh requests are limited around the agreed hourly threshold.
- Download/share requests are limited around the agreed hourly threshold.
- Limits use anonymous Cookie plus IP context.
- Limit state persists in SQLite or the chosen single-machine store.
- The public UI shows calm limit feedback.
- Tests cover allowed requests, blocked requests, and reset behavior.

## Confirmed Facts

- Parent issue #1 is the 句画 MVP epic; this task is child Slice 10.
- Blocker issue #5 is closed and already introduced anonymous identity plus recent-card avoidance for `/` and `GET /api/ready-card`.
- Existing anonymous cookie name is `juhua_anonymous_id`; proxy currently matches `/` and `/api/ready-card`, mints a UUID cookie, forwards it to downstream request handling, and sets `httpOnly`, `sameSite: "lax"`, `path: "/"`, plus `secure` for direct or forwarded HTTPS.
- Existing request context exposes `visitorKey` from the anonymous cookie and `requestContextKey` from anonymous cookie plus normalized IP context. Recent-card avoidance intentionally uses only `visitorKey`; this task must use cookie plus IP context, so `requestContextKey` is the natural rate-limit identity.
- Existing ready-card API is `GET /api/ready-card`; success returns `ReadyCardResponse`, empty stock returns `{ error: "ready_card_not_found", message }`, and the route is `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Existing homepage refresh flow already handles a local/future `ready_card_limited` response and preserves the current 图文卡片 with gentle copy.
- Download PNG and Share buttons are still placeholder UI actions; current public copy must remain truthful until later slices implement real download/share behavior.
- SQLite/Drizzle is the accepted single-machine persistence path; migrations live under `drizzle/`, runtime uses WAL and foreign keys, and feature reads/writes should use the shared Drizzle client except committed migration SQL.
- Browser-visible behavior belongs in Playwright under `tests/`; Node behavior tests may live under `node-tests/` when they exercise library/public service behavior without a browser.
- Next.js Route Handlers can await `cookies()` and `headers()` from `next/headers`, and return status `429` via `NextResponse.json(payload, { status: 429 })`.

## Requirements

1. Refresh rate limit
   - Apply an hourly anonymous rate limit before serving a new ready 图文卡片 from `GET /api/ready-card`.
   - The threshold must be around 120 refresh requests per cookie-plus-IP context per hour.
   - Blocked refresh requests must return HTTP `429` with a typed safe public payload.
   - A blocked refresh must not select a card, record a `ready_card_views` row, or consume ready-pool/recent-window state.

2. Download/share rate limit
   - Provide server-side rate-limit coverage for download and share public actions at around 60 requests per cookie-plus-IP context per hour.
   - Because real PNG download and Web Share file behavior remain future slices, this task must not claim that those capabilities are implemented.
   - The UI must still show truthful placeholder copy for allowed download/share clicks and calm limit copy for blocked download/share clicks.

3. Anonymous identity
   - Use the existing anonymous cookie plus normalized IP context as the limiting key.
   - Missing/invalid cookie behavior must keep relying on the existing proxy identity path.
   - The rate-limit key stored in SQLite must not store raw cookie values or raw IP addresses.

4. Persistence
   - Persist rate-limit counters/windows in SQLite through Drizzle schema and committed migration SQL.
   - The implementation must be safe for a single Next.js web process backed by local SQLite WAL.
   - Counter updates must be atomic for a given action/key/window so concurrent requests cannot exceed the limit by racing.

5. Public API and UI feedback
   - The public error reason for limit exhaustion should be typed as `ready_card_limited` and reuse calm Chinese copy.
   - The UI must preserve the current 图文卡片 on refresh limit and re-enable the button.
   - The UI must announce calm limit feedback for download/share when their placeholder action is rate-limited.
   - Public copy must not mention database, SQLite, setup commands, stack traces, provider/model errors, raw limits, raw IP, or cookie identifiers.

6. Type safety
   - Treat untrusted request/response JSON as `unknown` at boundaries and narrow through shared guards.
   - Avoid `any`; use literal action/reason types and exhaustive handling where practical.
   - Shared API response types should live in `lib/` rather than duplicated in UI code.

7. Tests
   - Tests must cover allowed requests, blocked requests, and reset behavior for refresh.
   - Tests must cover allowed requests, blocked requests, and reset behavior for download/share rate-limit behavior.
   - Tests must verify blocked refresh requests do not record ready-card views.
   - Browser-visible tests must verify calm UI feedback for refresh, download, and share limit states.
   - Existing ready-card and recent-card avoidance behavior must keep passing.

## Acceptance Criteria

- [ ] `GET /api/ready-card` allows refresh requests below the hourly threshold and still returns the existing public `{ card }` response shape.
- [ ] `GET /api/ready-card` returns HTTP `429` with `{ error: "ready_card_limited", message: string }` when the refresh threshold is exceeded.
- [ ] Blocked refresh requests do not insert `ready_card_views` rows and do not change the visible card in the browser.
- [ ] Download and share public action requests are limited around 60 per cookie-plus-IP context per hour.
- [ ] Download/share allowed states keep truthful placeholder announcements; blocked states show calm limit announcements.
- [ ] Limit state is stored durably in SQLite through committed Drizzle schema/migration changes.
- [ ] Limiting keys use hashed anonymous cookie plus normalized IP context and do not persist raw cookie/IP values.
- [ ] Atomic counter updates prevent obvious concurrent over-admission for the same action/context/window.
- [ ] Reset behavior is covered by tests: after the hourly window advances, the same context can perform the action again.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, focused tests, and `pnpm test:e2e` pass.

## Out of Scope

- Real DOM-to-PNG generation or file download implementation; Slice 11 owns that.
- Real Web Share file integration or fallback download; Slice 12 owns that.
- User accounts, logged-in per-user limits, saved history, collections, posting, or galleries.
- Distributed/multi-node rate-limit stores; accepted deployment is a single-machine SQLite-backed app.
- CAPTCHA, bot fingerprinting, or detection/evasion mechanisms.
- Changing recent-card avoidance semantics from cookie-only visitor history.

## Resolved Product Decisions

- Download/share placeholder button clicks should call a new no-op server action endpoint now so the issue's download/share limit acceptance is verifiable before real download/share features exist.
- Add a small `POST /api/card-action` endpoint for `download` and `share` that only checks/persists the limit and returns typed placeholder/limited responses.
- Keep UI copy explicit that real download/share are still future slices.

## Open Questions

- None.
