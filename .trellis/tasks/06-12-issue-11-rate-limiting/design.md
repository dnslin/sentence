# Design: Issue 11 Rate Limiting

## First-Principles Reasoning

### Challenge assumptions

- It is tempting to treat rate limiting as middleware-only. Unverified: the app has more than one action shape; refresh returns a card while download/share are still placeholders.
- It is tempting to key limits by IP only. Potentially wrong: normal proxy/mobile IP changes and shared networks can make IP-only identity unfair and unstable.
- It is tempting to key limits by cookie only. Potentially wrong: one client can mint new anonymous cookies, and the issue explicitly asks for Cookie plus IP context.
- It is tempting to add an external cache. Unverified and likely oversized: accepted deployment is a single VPS with SQLite WAL.
- It is tempting to implement real download/share to make them limitable. Wrong for this slice: later slices own those capabilities and current copy must remain truthful.

### Bedrock truths

- A rate limit is a deterministic decision over `(identity, action, time window, count, threshold)`.
- The system already has a privacy-preserving `requestContextKey`, derived from validated anonymous cookie plus normalized IP context, so raw cookie/IP values are not needed for persisted counters.
- SQLite is the durable single-machine store already used at runtime; with `BEGIN IMMEDIATE`, one writer can atomically read/update a counter before the protected action proceeds.
- `GET /api/ready-card` is the public refresh server boundary; limiting after card selection would waste ready-card state, so limiting must happen before selection.
- Download/share buttons have no real product effect yet; the only truthful action this slice can rate-limit is an explicit placeholder acknowledgement endpoint.
- Browser users need understandable feedback, not internal thresholds or operational details.

### Rebuild from ground up

1. Define a small action vocabulary: `refresh`, `download`, `share`.
2. For each incoming public action, derive a safe key from existing request context: `requestContextKey`.
3. Bucket time into fixed one-hour windows. Store one row per `(action, key, window_start)` with the consumed count.
4. Inside an immediate SQLite transaction, read or create the current row, increment if `count < limit`, otherwise return a blocked result with reset time.
5. Only if refresh is allowed, execute `getNextReadyCardForVisitor(...)`; if blocked, return `429 ready_card_limited` immediately.
6. For download/share placeholders, expose a narrow endpoint that performs the same check and returns typed `allowed` or `ready_card_limited` JSON without claiming file/share success.
7. UI code treats responses as `unknown`, narrows through shared guards, and announces allowed placeholder or calm limit copy.

### Contrast with convention

A conventional middleware/cache approach might place a generic IP limiter in front of every route. That would be simpler at the edge but less correct for this product: it would ignore the existing anonymous identity model, would not integrate with SQLite persistence, and would not handle placeholder download/share semantics without false product claims. The essential difference here is that the limiter is product-action aware and uses the already accepted single-machine persistence model.

### Conclusion

The most direct design is a shared SQLite-backed action rate-limit service keyed by existing cookie-plus-IP request context, wired before ready-card selection for refresh and through a small placeholder action endpoint for download/share.

## Architecture and Boundaries

### New shared rate-limit module

Create a `lib/rate-limit/` module owning:

- Public action constants and types:
  - `refresh` limit: `120` per `60 * 60 * 1000` ms.
  - `download` limit: `60` per `60 * 60 * 1000` ms.
  - `share` limit: `60` per `60 * 60 * 1000` ms.
- A clock-injectable service, e.g. `checkAndConsumeRateLimit({ client, action, contextKey, now })`.
- Result union:
  - `{ allowed: true; remaining: number; resetAt: Date }`
  - `{ allowed: false; retryAfterSeconds: number; resetAt: Date }`
- Helpers for fixed-window start and `Retry-After` header values.

The module should depend on `DatabaseClient` and Drizzle schema, not on Next.js route types.

### Database table

Add a `rate_limit_windows` table:

```text
rate_limit_windows(
  action text not null,
  context_key text not null,
  window_start integer not null,
  count integer not null check(count >= 0),
  created_at integer not null,
  updated_at integer not null,
  primary key(action, context_key, window_start)
)
```

Indexes:

- Primary key covers action/key/window lookup.
- Optional cleanup index on `window_start` if cleanup is implemented.

Stored facts are hashed context keys and action/window counters only. No raw cookie, raw IP, user-agent, or request path is persisted.

### Refresh route flow

`app/api/ready-card/route.ts`:

1. Open DB client.
2. Create `ReadyCardRequestContext` from awaited `cookies()` and `headers()`.
3. Consume `refresh` rate limit using `context.requestContextKey`.
4. If blocked, return `NextResponse.json<ReadyCardLimitErrorResponse>(..., { status: 429, headers: { "Retry-After": ... } })`.
5. If allowed, call existing `getNextReadyCardForVisitor(client, context)`.
6. Preserve existing `ready_card_not_found` and success behavior.

This keeps recent-card visitor history cookie-only while rate limiting uses cookie plus IP as required.

### Download/share placeholder endpoint

Recommended route: `app/api/card-action/route.ts`.

Request body:

```typescript
type CardActionRequest = {
  action: "download" | "share"
}
```

Allowed response:

```typescript
type CardActionResponse = {
  action: "download" | "share"
  status: "allowed"
  message: string
}
```

Limited response should reuse the shared public limit payload shape:

```typescript
type ReadyCardLimitErrorResponse = {
  error: "ready_card_limited"
  message: string
}
```

Invalid action response can be `400` with a safe typed error, but the UI should only send valid literals.

The endpoint does not perform PNG generation or Web Share. It only records that the visitor attempted the public placeholder action and returns copy that remains truthful.

### Shared public API types

Extend `lib/cards/public-ready-card.ts` or create a small adjacent API contract module so UI and routes share:

- `ReadyCardLimitErrorResponse` with reason `ready_card_limited`.
- Guard `isReadyCardLimitErrorResponse(value: unknown)`.
- Card action request/response types and guards if shared by the UI.

The existing local `RefreshLimitResponse` in `app/home-card-experience.tsx` should be removed once the public API owns `ready_card_limited`.

### UI data flow

`HomeCardExperience`:

- Refresh keeps existing behavior, but `ready_card_limited` comes from shared guard/type.
- Download button calls `POST /api/card-action` with `{ action: "download" }`.
- Share button calls `POST /api/card-action` with `{ action: "share" }`.
- Allowed download/share responses announce the same truthful placeholder copy as today.
- Limited download/share responses announce calm limit copy and do not imply that real capabilities were attempted.
- Network/invalid JSON failures use non-technical retry-oriented copy.

### Migration and setup

- Update `lib/db/schema.ts`.
- Add committed SQL migration under `drizzle/`.
- `pnpm db:migrate` must create the new table for development, tests, and production startup.

## Compatibility

- Existing clients of `GET /api/ready-card` still receive the same success and empty-stock payloads.
- New possible `429 ready_card_limited` matches the compatibility seam already present in the refresh client.
- Existing anonymous cookie semantics remain unchanged.
- Existing recent-card avoidance stays keyed by `visitorKey`, not `requestContextKey`.
- Download/share copy remains placeholder/truthful until later slices implement real capabilities.

## Operational Notes

- Fixed windows are simple and auditable; exact moving-window fairness is not required by "around" hourly thresholds.
- Old window rows can be left small for prototype scale or opportunistically pruned for rows older than a conservative retention horizon. If pruning is added, keep it bounded and non-blocking.
- `Retry-After` gives clients a standard cooldown hint without exposing raw internals in visible copy.

## Rollback Shape

- Revert route wiring and UI calls first to remove rate-limit enforcement.
- The database migration is additive; leaving the table unused is safe for rollback.
- No existing table columns or public card rows are modified by the migration.
