# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend work should preserve public browser behavior, avoid leaking prototype-only controls into production, and verify route-visible behavior through public interfaces when the route is the contract.

---

## Prototype-Only UI Controls

### Contract: production exclusion

**Scope / Trigger**: Any control, banner, switcher, debug affordance, or prototype-only navigation that is useful during development but should not exist in production.

**Signature**:

```typescript
const showPrototypeControl = process.env.NODE_ENV !== "production"

return <>{showPrototypeControl ? <PrototypeControl /> : null}</>
```

**Contracts**:

- Development/non-production may render the control if it is visibly separate from product content.
- Production must not render the control in the DOM or accessibility tree.
- CSS-only hiding is not enough for production exclusion.
- If development visibility or interaction is part of the feature contract, verify that behavior through a browser-observable check.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| `NODE_ENV !== "production"` | Control may be visible and discoverable when development visibility is part of the feature contract. |
| `NODE_ENV === "production"` | Control is not rendered. |
| Browser/accessibility snapshot contains the production-excluded label in production | Failing check; remove server-rendered output. |

**Good/Base/Bad Cases**:

- Good: a floating prototype switcher appears in dev and has shareable links when variant switching is a documented prototype contract.
- Base: the production page renders the main content without the switcher.
- Bad: the switcher is hidden with `display: none` but still exists in the production DOM.

**Tests Required**:

- Production build/server or equivalent rendered-output check confirms the control label is absent from page text/accessibility output.
- Development/non-production browser checks are required when the task changes the control's development visibility, interaction, or route-visible behavior.
- Small refactors that do not alter the control contract may rely on lint/type/build plus the production exclusion check.

**Wrong vs Correct**:

#### Wrong

```tsx
<nav className="hidden">原型切换器</nav>
```

#### Correct

```tsx
{process.env.NODE_ENV !== "production" ? <nav aria-label="原型切换器">...</nav> : null}
```

---

## Mock and Debug Route States

### Contract: production public routes must not expose false states

**Scope / Trigger**: Any production-facing route that can render loading, empty, error, or debug-only states that are not backed by real product data or real runtime failures.

**Signature**:

```tsx
const showDebugState = process.env.NODE_ENV !== "production"

export function Page() {
  return <PublicExperience />
}
```

**Contracts**:

- Public URLs must not let external users force mock-only `loading`, `empty`, or `error` states on production-facing routes.
- If debug state selection is needed, gate it behind a non-production-only seam or move it to a dedicated prototype/debug route.
- Production-facing route copy must distinguish placeholder behavior from implemented product behavior.
- Safe defaults must render truthful public content when a public route receives unknown, repeated, or unsupported query values.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Public route receives `?state=error` for a mock-only state | Ignore it or route to a non-production-only debug seam; do not render a false production error. |
| Public route receives repeated state values | Treat as unsupported and render the documented public default. |
| Non-production debug seam is enabled | Debug state may render if it is visibly separate from product content. |
| Production output contains debug/mock controls or copy implying fake failures | Failing check; remove or gate the debug behavior. |

**Good/Base/Bad Cases**:

- Good: `/` ignores `?state=error` when no real backend or data failure exists.
- Base: `/prototype?variant=paper-desk` selects a documented prototype variant on the prototype route.
- Bad: `/?state=empty` renders an empty-stock message before a real stock source exists.

**Tests Required**:

- Browser or route-level checks for public routes must cover unsupported debug query values when a prior implementation exposed them.
- Production build/server checks must confirm debug or prototype affordances are absent from the public route.
- If debug state remains in non-production, verify the gate and document how to access it.

**Wrong vs Correct**:

#### Wrong

```tsx
const state = useSearchParams().get("state")
return state === "error" ? <MockError /> : <PublicExperience />
```

#### Correct

```tsx
export function PublicPage() {
  return <PublicExperience />
}
```

---

## Development Dev-Resource Origins

### Contract: browser automation origins must be explicit

**Scope / Trigger**: Local browser automation or manual development opens a Next.js dev route from a host that differs from the dev server's canonical host, such as `127.0.0.1` when HMR/dev resources are served from `localhost`.

**Signature**:

```typescript
// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
}

export default nextConfig
```

**Contracts**:

- Add only the specific local development origins that are needed for browser checks or manual development.
- Do not use wildcard origins.
- Do not treat `allowedDevOrigins` as production CORS; it must not be paired with broad production response headers for this use case.
- Restart the dev server after changing `allowedDevOrigins`.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Browser checks open `http://127.0.0.1:<port>` and Next warns about blocked dev resources | Add `"127.0.0.1"` to `allowedDevOrigins`. |
| Browser checks use the canonical dev host, such as `localhost` | No extra origin is required. |
| A LAN/custom host is needed | Add that exact host only after confirming it is required for local development. |
| Production build/server | No wildcard CORS headers or broadened production response headers are introduced by this fix. |

**Good/Base/Bad Cases**:

- Good: `allowedDevOrigins: ["127.0.0.1"]` when `agent-browser` checks open `127.0.0.1` and HMR/dev resources need that origin.
- Base: no `allowedDevOrigins` entry when all browser checks use `localhost` and no warning appears.
- Bad: adding `"*"`, adding broad production CORS headers, or using this setting to mask an unrelated production cross-origin problem.

**Tests Required**:

- `pnpm typecheck` must accept the `NextConfig` shape.
- `pnpm build` must still pass and must not depend on the development-only origin allowance.
- A browser-observable dev check should use either the canonical host or the explicitly allowed local host.

**Wrong vs Correct**:

#### Wrong

```typescript
const nextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
  ],
}
```

#### Correct

```typescript
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
}
```

---

## Reduced Motion Browser Checks

### Contract: inspect individual transform properties

**Scope / Trigger**: Any browser-observable check that verifies Tailwind CSS transform or animation behavior, especially `prefers-reduced-motion` handling.

**Signature**:

```typescript
const styles = getComputedStyle(element)
const duration = styles.transitionDuration
const rotate = styles.rotate
const transform = styles.transform
```

**Contracts**:

- Tailwind CSS may emit individual transform properties such as `rotate`, `scale`, or `translate` rather than a matrix-valued `transform` property.
- A reduced-motion check must inspect the individual property that the implementation uses, not only `transform`.
- Reduced-motion behavior passes only when non-essential transition duration is `0s` and the relevant transform property is neutral, such as `rotate === "none"` or `rotate === "0deg"`.
- Default-motion behavior may be verified with either visible movement or computed styles, but the assertion must target the emitted property.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Default motion uses a `motion-safe` transform utility | The relevant computed property may be non-neutral while computed `transform` remains `none`. |
| Reduced motion neutralizes non-essential motion | Computed `transitionDuration` is `0s` or otherwise non-animated, and the relevant transform property is neutral. |
| A check only asserts `transform !== "none"` for Tailwind rotate utilities | Treat as an invalid check; it can false-fail when rotate is emitted separately. |
| A check only asserts `transform === "none"` under reduced motion | Incomplete; also inspect `rotate`, `scale`, or `translate` when those utilities are used. |

**Good/Base/Bad Cases**:

- Good: after triggering a refresh control, default motion reports a non-neutral emitted transform property such as `rotate`, `scale`, `translate`, or `transform`; reduced motion reports non-animated transition timing and neutral emitted transform properties.
- Base: components without transform utilities only check transition duration or visible behavior.
- Bad: failing a valid Tailwind rotate animation because `getComputedStyle(element).transform` is `none`.

**Tests Required**:

- Browser checks for reduced-motion features must emulate `prefers-reduced-motion: reduce` and assert the actual computed property used by the class (`rotate`, `scale`, `translate`, or `transform`).
- If default motion is part of the behavior contract, also verify the default media mode so the reduced-motion assertion is not vacuous.

**Wrong vs Correct**:

#### Wrong

```typescript
const styles = getComputedStyle(card)
expect(styles.transform).not.toBe("none")
```

#### Correct

```typescript
const styles = getComputedStyle(card)
expect(styles.transitionDuration).toBe("0s")
expect(["none", "0deg"]).toContain(styles.rotate)
```

---

## Refresh Action UI State

### 1. Scope / Trigger

Use this contract when a production-facing route turns a placeholder action into a real browser/API flow, especially the homepage `再来一张` refresh action.

### 2. Signatures

**Component inputs**

```typescript
export function HomeCardExperience({ card }: { card: PublicReadyCard })
```

**API response guard**

```typescript
function isReadyCardResponse(value: unknown): value is ReadyCardResponse
function isReadyCardErrorResponse(value: unknown): value is ReadyCardErrorResponse
```

**Public error response**

```typescript
type ReadyCardErrorResponse = {
  error: "ready_card_not_found"
  message: string
}
```

**Public limit response**

After the rate-limit slice, `ready_card_limited` is a shared public API response for refresh and placeholder card actions. UI code must import the shared type guard instead of redefining the shape locally.

```typescript
type ReadyCardLimitErrorResponse = {
  error: "ready_card_limited"
  message: string
}

function isReadyCardLimitErrorResponse(
  value: unknown
): value is ReadyCardLimitErrorResponse
```

**Renderer state**

```typescript
export function QuietGalleryCard({
  card,
  isRefreshing,
  isTilted,
}: {
  card: PublicReadyCard
  isRefreshing: boolean
  isTilted: boolean
})
```

### 3. Contracts

- The client may replace the rendered 图文卡片 only after `/api/ready-card` returns `ok` and the JSON narrows through `isReadyCardResponse`.
- `PublicReadyCard` includes `illustrationUrl: string | null`; frontend code must consume this shared DTO rather than redefine the API response shape.
- Non-OK `/api/ready-card` JSON must be treated as `unknown` and narrowed through the shared `isReadyCardErrorResponse` guard before reading current production error fields.
- `ready_card_not_found` maps to calm empty-stock copy while preserving the current 图文卡片.
- `ready_card_limited` maps to gentle limit copy while preserving the current 图文卡片 only through the local refresh-client compatibility seam until the rate-limit slice adds the production API contract.
- Unknown non-OK statuses, network failures, invalid JSON, and invalid success shapes map to non-technical retry-oriented failure copy.
- API code must expose only safe same-origin generated-illustration paths as `illustrationUrl`; unsafe stored values must reach the frontend as `null`.
- When `illustrationUrl` is a string, the card renderer must display a real image using that URL and the card's `sceneLabel` as the accessible label/alt text.
- When `illustrationUrl` is `null`, the card renderer must preserve the existing CSS fallback illustration and expose the same `sceneLabel` through `role="img"`.
- While refresh is pending, the button must be disabled or otherwise prevent duplicate concurrent requests.
- Pending state must be visible through public UI, such as button copy and `aria-busy` on the card article.
- Failure must keep the current card visible, announce that refresh failed, and re-enable retry.
- Public copy must say refresh is implemented only after it really calls the API; download/share placeholder copy must remain truthful until those actions are implemented.
- Non-essential motion must use `motion-safe`/`motion-reduce` so reduced-motion users do not depend on animation to understand state.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| API returns valid `{ card }` | Replace sentence and illustration accessible label together. |
| API returns `illustrationUrl` as a string | Render a real image whose URL matches `illustrationUrl` and whose accessible name/alt is `sceneLabel`. |
| API returns `illustrationUrl: null` | Render the CSS fallback illustration with `role="img"` and `aria-label=sceneLabel`. |
| API returns non-OK unknown status or invalid error payload | Keep current card, announce non-technical retry-oriented failure, re-enable refresh. |
| API returns `ready_card_not_found` | Keep current card, announce calm empty-stock copy, re-enable refresh. |
| Future/local refresh seam receives `ready_card_limited` | Keep current card, announce gentle limit copy, re-enable refresh without starting generation or automatic retry. |
| API returns invalid JSON shape | Keep current card, announce failure, re-enable refresh. |
| User clicks repeatedly while pending | Send at most one in-flight refresh request. |
| Pending state active | Existing card remains visible and exposes busy/loading state. |
| Reduced motion active | State remains understandable without relying on transform animation. |

### 5. Good/Base/Bad Cases

- Good: clicking `再来一张` changes both `“sentence”` text and image accessible label after a successful API response.
- Good: a card with `illustrationUrl` renders a browser-fetchable `<img>` using the same-origin stored WebP URL.
- Base: a seeded/mock card with `illustrationUrl: null` renders the existing CSS fallback and remains accessible through `role="img"`.
- Good: a failed refresh with `ready_card_not_found` keeps the visible card and announces that new 图文卡片 are still being prepared.
- Good: a future/local refresh limit response keeps the visible card and announces gentle limit copy without starting a retry loop.
- Base: a delayed API response shows `刷新生成中`, disables the button, and leaves the current card visible.
- Bad: optimistically replacing only the sentence before the server returns a canonical 图文绑定.
- Bad: catching refresh failure by clearing the card or showing fake empty-stock UI.
- Bad: rendering a broken `<img src="">` for null-image seed cards instead of preserving the fallback.

### 6. Tests Required

For refresh UI work, use browser-visible tests that assert:

- Clicking `再来一张` waits for `/api/ready-card` and replaces sentence plus image accessible label.
- A ready-card response with `illustrationUrl` renders a real image whose `src` is the public WebP URL and whose accessible name is the scene label.
- A ready-card response with `illustrationUrl: null` keeps the CSS fallback illustration accessible through the scene label.
- A delayed response shows pending copy/state and prevents duplicate requests.
- A failed response keeps the current card, announces non-technical retry-oriented failure, and allows retry.
- A `ready_card_not_found` response keeps the current card, announces calm empty-stock copy, and allows retry.
- A future/local `ready_card_limited` response seam keeps the current card, announces gentle limit copy, and does not start an automatic retry/generation loop.
- Placeholder actions not implemented in the current slice still announce truthful placeholder copy.

### 7. Wrong vs Correct

#### Wrong

```tsx
// Trusts untyped JSON and can replace only part of the card binding.
const body = await response.json()
setCurrentCard(body.card)
```

```tsx
// Breaks seeded ready cards whose illustrationUrl is intentionally null.
<img src={card.illustrationUrl ?? ""} alt={card.sceneLabel} />
```

#### Correct

```tsx
const body: unknown = await response.json()
if (!isReadyCardResponse(body)) throw new Error("invalid ready-card response")
setCurrentCard(body.card)
```

```tsx
{card.illustrationUrl ? (
  <img src={card.illustrationUrl} alt={card.sceneLabel} />
) : (
  <div role="img" aria-label={card.sceneLabel}>{/* fallback art */}</div>
)}
```

---

## Placeholder Download/Share Action UI State

### 1. Scope / Trigger

Use this contract when a production-facing route keeps download/share as placeholder actions while still recording or limiting those public action attempts through the server.

### 2. Signatures

**Card action endpoint**

```typescript
// app/api/card-action/route.ts
POST /api/card-action
```

**Request/response contracts**

```typescript
type CardActionRequest = {
  action: "download" | "share"
}

type CardActionResponse = {
  action: "download" | "share"
  status: "allowed"
  message: string
}

type ReadyCardLimitErrorResponse = {
  error: "ready_card_limited"
  message: string
}
```

**Shared guards**

```typescript
function isCardActionResponse(value: unknown): value is CardActionResponse
function isReadyCardLimitErrorResponse(
  value: unknown
): value is ReadyCardLimitErrorResponse
```

### 3. Contracts

- Download/share buttons may call `POST /api/card-action` to record and rate-limit placeholder action attempts.
- An allowed response must preserve truthful placeholder copy: it may say PNG download/share will arrive in a later slice, but must not create or imply a real file/share operation.
- A `ready_card_limited` response must announce calm limit copy, preserve the current 图文卡片, and re-enable the button.
- Invalid JSON, network failures, unknown non-OK responses, and invalid success payloads map to non-technical retry-oriented copy.
- UI code must treat endpoint JSON as `unknown` and narrow through shared guards; do not duplicate card-action payload types locally in components.
- Pending placeholder action state should prevent duplicate same-action requests when practical and should use clear button copy such as `下载确认中` / `分享确认中`.
- This placeholder endpoint does not make real DOM-to-PNG or Web Share capabilities available; public copy must continue to say those capabilities are future slices.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `POST /api/card-action` returns valid allowed `download` response | Announce truthful PNG placeholder copy. |
| `POST /api/card-action` returns valid allowed `share` response | Announce truthful share placeholder copy. |
| Endpoint returns `429 ready_card_limited` | Announce calm limit copy and keep current card visible. |
| Endpoint returns invalid success JSON | Announce non-technical failure copy. |
| Endpoint request fails or returns unknown non-OK JSON | Announce non-technical failure copy. |
| User clicks the same placeholder action while pending | Do not send duplicate concurrent requests for that action when the button is disabled. |

### 5. Good/Base/Bad Cases

- Good: clicking `下载 PNG` calls `/api/card-action` with `{ action: "download" }`, receives allowed placeholder copy, and does not start client-side PNG generation.
- Good: clicking `分享` calls `/api/card-action` with `{ action: "share" }`, receives allowed placeholder copy, and does not call `navigator.share` before the share slice.
- Good: a `429 ready_card_limited` response keeps the current 图文卡片 and says the operation is too frequent in calm language.
- Base: placeholder action network failure leaves the card visible and asks the user to retry later.
- Bad: pure client-only placeholder clicks after the rate-limit slice; download/share server-side limits would not be exercised.
- Bad: changing button copy to imply real PNG or system share support before later slices implement those capabilities.

### 6. Tests Required

For placeholder action UI work, use browser-visible tests that assert:

- `下载 PNG` sends `{ action: "download" }` to `/api/card-action` and announces allowed placeholder copy.
- `分享` sends `{ action: "share" }` to `/api/card-action` and announces allowed placeholder copy.
- `429 ready_card_limited` from `/api/card-action` announces calm limit copy and re-enables the clicked button.
- Failure or invalid endpoint payload leaves the current 图文卡片 visible and announces non-technical retry copy.
- `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.

### 7. Wrong vs Correct

#### Wrong

```tsx
// Bypasses server-side action limiting after the rate-limit slice.
<Button onClick={() => announce("PNG 下载会在后续切片接入。")}>下载 PNG</Button>
```

```tsx
// Claims a real capability before the owning slice exists.
<Button onClick={() => announce("已下载 PNG")}>下载 PNG</Button>
```

#### Correct

```tsx
const response = await fetch("/api/card-action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "download" }),
})
const body: unknown = await response.json().catch(() => null)

if (!response.ok) {
  announce(
    isReadyCardLimitErrorResponse(body)
      ? cardActionLimitAnnouncement
      : cardActionFailureAnnouncement
  )
  return
}

if (!isCardActionResponse(body)) throw new Error("invalid action response")
announce(body.message)
```

---

## Required Patterns

- For route features, verify the route through browser-observable behavior when feasible.
- Keep prototype copy from implying future slices are already implemented.
- Use semantic elements (`main`, `section`, `article`, `nav`, `aside`) for page structure.

---

## Forbidden Patterns

- No debug logging left in production-facing frontend code.
- No prototype-only controls rendered in production DOM.
- No copy that claims unavailable actions such as refresh/download/share before those slices implement them.

---

## Code Review Checklist

- [ ] Linter passes.
- [ ] Type checker passes.
- [ ] Production build passes.
- [ ] Browser-visible acceptance criteria are checked through a browser tool or equivalent public interface when the route/control behavior is the public contract.
- [ ] Prototype/development affordances are absent from production output.
