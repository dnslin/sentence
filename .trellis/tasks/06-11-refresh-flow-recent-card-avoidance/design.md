# Design: refresh flow with recent-card avoidance

## First-Principles Reasoning

### Challenge assumptions

- Assumption: the refresh button can simply fetch the first ready card. Wrong for this issue because the same deterministic first card would repeat.
- Assumption: browser state alone is enough. Unverified and weak because the server must select the next card before it can trust or apply avoidance.
- Assumption: IP alone identifies a user. Potentially wrong because IPs are shared and can change.
- Assumption: homepage and API can use separate selection paths. Wrong because the initial page card would otherwise be invisible to the refresh recent window.
- Assumption: tests can inspect repository internals. Wrong for this project; ready-card behavior should be verified through API/page seams.

### Bedrock truths

- The server can avoid returning recent cards only if each request carries or maps to a stable anonymous identity.
- Without an account, the only browser-stable request state available to the server is a cookie or an explicit client-sent value; a cookie is the least visible and most HTTP-native option.
- To count the first homepage card, the server must have the anonymous identity before `app/page.tsx` selects and records a card.
- SQLite is already the local source of truth for ready-card metadata and is suitable for a small recent-view table; the target pool is about 200 cards, so selecting in application code from a bounded ready set is cheap and simpler than complex SQL.
- Storing raw cookies or raw IP addresses is not necessary for selection; hashed derived keys are enough.

### Rebuild from verified truths

1. Add a request boundary that ensures `/` and `/api/ready-card` have an anonymous cookie before server selection.
2. Derive a visitor key from the anonymous cookie plus normalized request IP/header context.
3. Store only hashed visitor keys and served card IDs in SQLite.
4. Use one repository/service function for both page load and API refresh: load ready cards, load visitor history, exclude the most recent 50 when possible, choose an unseen/least-recent eligible card, then record the served card.
5. Keep the public `ReadyCardResponse` shape unchanged so UI and tests remain stable.
6. Let the client refresh button fetch the existing API and update local card state only after a validated success response.

### Contrast with convention

A conventional shortcut would keep recent IDs in `localStorage` or pass `exclude=currentId` from the client. That is simpler, but it does not let the server enforce a recent-50 window across API/page seams and it misses the first server-rendered card. The selected design keeps the identity and selection logic at the server boundary while keeping the UI contract small.

### Conclusion

The minimal fundamental mechanism is: anonymous cookie minted before page/API handling, hashed cookie+IP request context, SQLite recent-view records, one shared ready-card selection path, and client UI state that swaps cards only on validated API success.

## Architecture and Boundaries

### Request identity boundary

- Add `proxy.ts` at the repo root.
- Match `/` and `/api/ready-card` only.
- If `juhua_anonymous_id` is missing or invalid:
  - mint `crypto.randomUUID()`;
  - add it to the forwarded request `Cookie` header so Server Components/Route Handlers see it during the same request;
  - set it on the outgoing response as an HTTP-only, `SameSite=Lax`, `path=/` session cookie.
- If a valid cookie exists, forward the request unchanged.

### Request context helpers

- Add a small server-side helper for ready-card request context.
- Read `x-forwarded-for` first, then `x-real-ip`, then fall back to `unknown`.
- Normalize the first forwarded IP token by trimming and lowercasing.
- Derive a `visitorKey` with SHA-256 from anonymous cookie value plus normalized IP context.
- Do not store raw cookie values or raw IP values.

### Database model

Add a committed migration and Drizzle schema table for recent served cards:

```text
ready_card_views(
  id text primary key,
  visitor_key text not null,
  card_id text not null references cards(id),
  seen_at integer not null
)
```

Indexes:

- `(visitor_key, seen_at)` or `(visitor_key, seen_at desc)` for recent-window reads.
- Optional `(visitor_key, card_id, seen_at)` if implementation needs efficient latest-seen grouping.

### Ready-card selection service

Replace the single-purpose `getOneReadyCard` usage with a shared service such as `getNextReadyCardForVisitor(client, context)`.

Selection contract:

1. Load all ready cards ordered by `createdAt`, `id`; filter valid public accents/status as today.
2. If none exist, return `null`.
3. Load this visitor's recent view records ordered newest-first.
4. Build the most recent 50 card ID set.
5. Prefer ready cards outside that set.
6. Within eligible cards, prefer cards never seen by this visitor; otherwise prefer least-recently seen cards.
7. If every ready card is in the recent-50 set, fall back to the least-recently seen ready card rather than returning a false 404.
8. Record the selected card with current timestamp and return its `PublicReadyCard` DTO.

The ready pool target is small enough that this can be application-level selection over bounded rows instead of complex SQL. That keeps the module simple and TypeScript-narrowed.

### API contract

- Keep `GET /api/ready-card`.
- Keep success payload: `{ card: PublicReadyCard }`.
- Keep `404` error payload: `{ error: "ready_card_not_found", message: string }`.
- Use the shared selection service and close the SQLite connection in `finally`.

### Homepage contract

- `app/page.tsx` reads `cookies()` and `headers()` asynchronously.
- It builds the same ready-card request context as the API.
- It calls the same selection service so the initial server-rendered card is recorded.
- It still renders `HomeExperience card={card}` and fails clearly if no card exists.

### Client UI contract

- `HomeCardExperience` owns current card state, refresh pending state, and announcement state.
- On `再来一张`:
  - ignore duplicate clicks while pending;
  - set pending state;
  - fetch `/api/ready-card` with `cache: "no-store"`;
  - validate the JSON with shared public-ready-card type guards;
  - replace current card only after validation succeeds;
  - announce success.
- On failure:
  - keep current card;
  - announce that refresh failed and the current card is retained;
  - re-enable the button.
- Use calm transition classes on the existing card renderer, with `motion-reduce` disabling non-essential transform/transition behavior.
- Keep download/share placeholder copy truthful.

## Compatibility and Migration Notes

- The public ready-card DTO does not change.
- The API URL does not change.
- Existing local SQLite databases receive a new migration for `ready_card_views`.
- The seed expands from one ready card to enough deterministic ready cards for recent-window tests; the first seed card remains unchanged for compatibility with existing expectations.
- No real image URL is introduced in this slice; the current CSS illustration binding remains represented by `sceneLabel` and `accent`.

## Trade-offs

- Server-side history table over cookie-stored recent IDs: more durable for page/API consistency and avoids trusting large client-managed lists; costs one small table.
- Session cookie over persistent cookie: matches current-visit product semantics and minimizes tracking; cross-visit avoidance can be added later with explicit retention policy.
- Application-level selection over SQL-only selection: simpler and safe for a ~200-card ready pool; if pool size grows materially, move least-recent selection into SQL.

## Rollback Shape

- Revert `proxy.ts`, request-context helpers, recent-view schema/migration, and the shared selection service call sites.
- Restore API/page to `getOneReadyCard` if needed.
- Keep seed expansion only if it remains useful; otherwise revert to the single seed card.
