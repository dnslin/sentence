# Design: Issue 10 empty stock and failure states

## First-principles basis

### Challenge assumptions

- Assumption: empty inventory should throw a setup error. This was useful during local bootstrapping but conflicts with a public route whose backend can legitimately have zero stock.
- Assumption: every non-OK refresh response can use one generic failure copy. This hides important user-facing distinctions: empty stock, transient operational failure, and limit response.
- Assumption: handling a limit response requires implementing rate limiting now. GitHub issue #11 owns rate-limit counting/persistence; this slice only needs the public response/client contract so future limits do not leak technical details.
- Assumption: empty stock should trigger live generation. ADR 0002 chose pregenerated serving to avoid user wait and model-spend spikes; user-triggered generation would violate that resource boundary.

### Bedrock truths

- A visitor can only see either a ready card, a safe empty state, or a safe failure/limit message.
- The public browser must not receive stack traces, DB setup commands, provider/model errors, secrets, or raw generation diagnostics.
- The ready pool is finite; zero ready rows is a valid runtime state.
- A browser click can safely request one replacement card; unbounded retry or generation loops would consume server/model resources without new user intent.
- TypeScript can model all public response variants at the module boundary, so client code can branch on narrowed values rather than casts.

### Rebuild from truths

- Keep `getNextReadyCardForVisitor(...)` as the single source of ready-card selection truth.
- Convert `null` selection into a public empty-stock UI state for `app/page.tsx`, not a thrown technical error.
- Convert `null` selection into a typed public API error response for `/api/ready-card`.
- Share response/error types and type guards in `lib/cards/public-ready-card.ts` so server and client use one public contract.
- In the refresh client, parse non-OK responses as `unknown`, narrow to the public error union, and map known error codes to calm copy. Unknown non-OK/invalid JSON falls back to the operational failure copy.
- Keep current card state intact for every refresh failure path.

### Contrast with convention

Conventional quick fixes often catch every error and display one generic toast. That is suboptimal here because issue #10 explicitly distinguishes empty-stock, API failure, and limit states, and because public copy must avoid implying immediate generation.

## Architecture and boundaries

### Public response contract

Extend `lib/cards/public-ready-card.ts` with shared public response types:

```typescript
type ReadyCardUnavailableReason =
  | "ready_card_not_found"
  | "ready_card_limited"

export type ReadyCardErrorResponse = {
  error: ReadyCardUnavailableReason
  message: string
}

export type ReadyCardApiResponse = ReadyCardResponse | ReadyCardErrorResponse
```

Also add type guards such as `isReadyCardErrorResponse(...)` and `isReadyCardLimitedResponse(...)` as needed. Do not use `any`; all JSON is handled as `unknown` at the boundary.

### Homepage state

`app/page.tsx` continues to open one DB client, create the ready-card request context, and call `getNextReadyCardForVisitor(...)` directly.

- If a card exists: return `<HomeExperience card={card} />`.
- If no card exists: return a public empty-stock experience, likely through `<HomeExperience card={null} />` or a small sibling component in `app/home-experience.tsx`.
- The empty state should retain the public page shell/header but not render `QuietGalleryCard`, because there is no valid 图文绑定.

### API state

`app/api/ready-card/route.ts` returns:

- `200 { card }` for success.
- `404 { error: "ready_card_not_found", message: <safe Chinese empty-stock API message> }` for empty stock.

No DB setup command, local-store detail, generation detail, stack trace, or provider detail appears in the public payload.

This slice will not produce a real `429 ready_card_limited` response from production API because issue #11 owns rate limiting. Tests can route/mock a 429 response at the browser boundary to verify the client handles that public shape.

### Refresh client state

`app/home-card-experience.tsx` keeps these invariants:

- Do not fetch while `isRefreshing` is true.
- Set pending copy once per user click.
- On success, replace the whole `PublicReadyCard` only after `isReadyCardResponse(...)` passes.
- On known `ready_card_not_found`, announce the required empty-stock copy.
- On known `ready_card_limited`, announce the required limit copy.
- On unknown non-OK status, network failure, invalid JSON, or invalid success shape, announce the required operational failure copy.
- Always preserve `currentCard` unless a valid success response is received.
- Always clear pending state in `finally`.

### Error and logging posture

- Avoid logging browser-visible caught errors in client code.
- Let unexpected server exceptions continue to Next.js operational handling, but public expected states (empty inventory) must be represented explicitly.
- Do not include raw thrown `Error.message` in public payloads.

## Data flow

```text
Homepage request
  → proxy ensures anonymous cookie
  → app/page.tsx creates request context
  → getNextReadyCardForVisitor(...)
  → card ? HomeExperience(card) : HomeExperience(empty)

Refresh click
  → one fetch('/api/ready-card') while not pending
  → 200 + valid { card } replaces card
  → 404 ready_card_not_found maps to empty-stock copy
  → 429 ready_card_limited maps to limit copy
  → any other failure maps to operational retry copy
```

## Compatibility

- `PublicReadyCard` remains unchanged so existing renderers and API success tests remain compatible.
- `ReadyCardResponse` remains the success shape; broader API/error types are additive.
- Existing #11 rate-limit implementation can later return `429 { error: "ready_card_limited", message: ... }` without changing the refresh client contract.
- Empty homepage no longer follows the older backend spec line that required a local setup error; this task supersedes that behavior because issue #10 and ADR 0002 require public empty-stock handling.

## Rollback considerations

- The change is localized to public DTO types, homepage rendering, API empty response copy, and Playwright tests.
- If the empty-state renderer causes layout regressions, rollback can keep the API/client error handling and revert only the homepage empty component.
- No migration is required.
