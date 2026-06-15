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

| Condition                                                                           | Required behavior                                                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NODE_ENV !== "production"`                                                         | Control may be visible and discoverable when development visibility is part of the feature contract. |
| `NODE_ENV === "production"`                                                         | Control is not rendered.                                                                             |
| Browser/accessibility snapshot contains the production-excluded label in production | Failing check; remove server-rendered output.                                                        |

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
{
  process.env.NODE_ENV !== "production" ? (
    <nav aria-label="原型切换器">...</nav>
  ) : null
}
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

| Condition                                                                     | Required behavior                                                                               |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Public route receives `?state=error` for a mock-only state                    | Ignore it or route to a non-production-only debug seam; do not render a false production error. |
| Public route receives repeated state values                                   | Treat as unsupported and render the documented public default.                                  |
| Non-production debug seam is enabled                                          | Debug state may render if it is visibly separate from product content.                          |
| Production output contains debug/mock controls or copy implying fake failures | Failing check; remove or gate the debug behavior.                                               |

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

| Condition                                                                                | Required behavior                                                                             |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Browser checks open `http://127.0.0.1:<port>` and Next warns about blocked dev resources | Add `"127.0.0.1"` to `allowedDevOrigins`.                                                     |
| Browser checks use the canonical dev host, such as `localhost`                           | No extra origin is required.                                                                  |
| A LAN/custom host is needed                                                              | Add that exact host only after confirming it is required for local development.               |
| Production build/server                                                                  | No wildcard CORS headers or broadened production response headers are introduced by this fix. |

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

| Condition                                                                 | Required behavior                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Default motion uses a `motion-safe` transform utility                     | The relevant computed property may be non-neutral while computed `transform` remains `none`.                     |
| Reduced motion neutralizes non-essential motion                           | Computed `transitionDuration` is `0s` or otherwise non-animated, and the relevant transform property is neutral. |
| A check only asserts `transform !== "none"` for Tailwind rotate utilities | Treat as an invalid check; it can false-fail when rotate is emitted separately.                                  |
| A check only asserts `transform === "none"` under reduced motion          | Incomplete; also inspect `rotate`, `scale`, or `translate` when those utilities are used.                        |

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
function isReadyCardErrorResponse(
  value: unknown
): value is ReadyCardErrorResponse
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
- `ready_card_limited` maps to gentle limit copy while preserving the current 图文卡片.
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

| Condition                                                  | Required behavior                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| API returns valid `{ card }`                               | Replace sentence and illustration accessible label together.                                                     |
| API returns `illustrationUrl` as a string                  | Render a real image whose URL matches `illustrationUrl` and whose accessible name/alt is `sceneLabel`.           |
| API returns `illustrationUrl: null`                        | Render the CSS fallback illustration with `role="img"` and `aria-label=sceneLabel`.                              |
| API returns non-OK unknown status or invalid error payload | Keep current card, announce non-technical retry-oriented failure, re-enable refresh.                             |
| API returns `ready_card_not_found`                         | Keep current card, announce calm empty-stock copy, re-enable refresh.                                            |
| API returns `ready_card_limited`                           | Keep current card, announce gentle limit copy, re-enable refresh without starting generation or automatic retry. |
| API returns invalid JSON shape                             | Keep current card, announce failure, re-enable refresh.                                                          |
| User clicks repeatedly while pending                       | Send at most one in-flight refresh request.                                                                      |
| Pending state active                                       | Existing card remains visible and exposes busy/loading state.                                                    |
| Reduced motion active                                      | State remains understandable without relying on transform animation.                                             |

### 5. Good/Base/Bad Cases

- Good: clicking `再来一张` changes both `“sentence”` text and image accessible label after a successful API response.
- Good: a card with `illustrationUrl` renders a browser-fetchable `<img>` using the same-origin stored WebP URL.
- Base: a seeded/mock card with `illustrationUrl: null` renders the existing CSS fallback and remains accessible through `role="img"`.
- Good: a failed refresh with `ready_card_not_found` keeps the visible card and announces that new 图文卡片 are still being prepared.
- Good: a `ready_card_limited` response keeps the visible card and announces gentle limit copy without starting a retry loop.
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
- A `ready_card_limited` response keeps the current card, announces gentle limit copy, and does not start an automatic retry/generation loop.
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
{
  card.illustrationUrl ? (
    <img src={card.illustrationUrl} alt={card.sceneLabel} />
  ) : (
    <div role="img" aria-label={card.sceneLabel}>
      {/* fallback art */}
    </div>
  )
}
```

---

## Card Action Gate for Download and Share UI State

### 1. Scope / Trigger

Use this contract when a production-facing route starts a public card action through `POST /api/card-action`. After Slice 11, `download` is a real PNG export gated by this endpoint; `share` remains a truthful placeholder until the Web Share slice.

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

- Download/share buttons must call `POST /api/card-action` before performing the public action so server-side anonymous rate limits are exercised.
- A valid allowed response must echo the requested action; if `body.action !== requestedAction`, treat the payload as invalid and show retry-oriented failure copy.
- For `download`, a valid allowed response may continue into the PNG export flow. A blocked or invalid response must not generate a PNG or trigger a browser download.
- For `share`, allowed responses must preserve truthful placeholder copy until real Web Share behavior is implemented.
- A `ready_card_limited` response must announce calm limit copy, preserve the current 图文卡片, and re-enable the button.
- Invalid JSON, network failures, unknown non-OK responses, and invalid success payloads map to non-technical retry-oriented copy.
- UI code must treat endpoint JSON as `unknown` and narrow through shared guards; do not duplicate card-action payload types locally in components.
- Pending action state must prevent duplicate and ambiguous concurrent public actions. Disable both download/share buttons while either action is pending, and use clear button copy such as `PNG 准备中` / `分享确认中` for the active action.
- Public copy must match implemented capability: download may claim PNG export only after the export slice; share must remain future-slice copy until its owning slice.

### 4. Validation & Error Matrix

| Condition                                                         | Required behavior                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST /api/card-action` returns valid allowed `download` response | Continue into the PNG export flow.                                                |
| `POST /api/card-action` returns valid allowed `share` response    | Announce truthful share placeholder copy; do not call `navigator.share` yet.      |
| Allowed response action does not match the requested action       | Treat as invalid payload; show retry-oriented failure copy and do not act.        |
| Endpoint returns `429 ready_card_limited`                         | Announce calm limit copy, keep current card visible, and do not export/share.     |
| Endpoint returns invalid success JSON                             | Announce non-technical failure copy.                                              |
| Endpoint request fails or returns unknown non-OK JSON             | Announce non-technical failure copy.                                              |
| User clicks either action while an action is pending              | Both action buttons are disabled; do not silently drop an enabled-looking click.  |

### 5. Good/Base/Bad Cases

- Good: clicking `下载 PNG` calls `/api/card-action` with `{ action: "download" }`, receives an echoed allowed response, then exports the current 图文卡片.
- Good: clicking `分享` calls `/api/card-action` with `{ action: "share" }`, receives allowed placeholder copy, and does not call `navigator.share` before the share slice.
- Good: while a download export request is pending, both `下载 PNG` and `分享` are disabled so the UI does not silently drop an enabled-looking share click.
- Good: a `429 ready_card_limited` response keeps the current 图文卡片 and says the operation is too frequent in calm language.
- Base: action network failure leaves the card visible and asks the user to retry later.
- Bad: pure client-only action clicks after the rate-limit slice; server-side limits would not be exercised.
- Bad: using an allowed `share` response to trigger PNG export, or an allowed `download` response to trigger share behavior.

### 6. Tests Required

For card-action UI work, use browser-visible tests that assert:

- `下载 PNG` sends `{ action: "download" }` to `/api/card-action` before a browser download is observed.
- `分享` sends `{ action: "share" }` to `/api/card-action` and announces placeholder copy while no PNG download or system share occurs.
- `429 ready_card_limited` from `/api/card-action` announces calm limit copy, re-enables the clicked button, and does not continue into the action.
- Failure or invalid endpoint payload leaves the current 图文卡片 visible and announces non-technical retry copy.
- While one action is pending, both action buttons are disabled and no enabled-looking click is silently dropped.
- `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.

### 7. Wrong vs Correct

#### Wrong

```tsx
// Bypasses server-side action limiting after the rate-limit slice.
<Button onClick={() => exportReadyCardToPng(currentCard)}>下载 PNG</Button>
```

```tsx
// Trusts a success payload for the wrong action.
if (isCardActionResponse(body)) await exportReadyCardToPng(currentCard)
```

#### Correct

```tsx
const requestedAction = "download"
const response = await fetch("/api/card-action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: requestedAction }),
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

if (!isCardActionResponse(body) || body.action !== requestedAction) {
  throw new Error("invalid action response")
}
```

---

## DOM-to-PNG Download Export UI State

### 1. Scope / Trigger

Use this contract when `下载 PNG` is implemented as a browser-visible export of the current 图文卡片.

### 2. Signatures

**Client exporter**

```typescript
export const READY_CARD_EXPORT_WIDTH = 1080
export const READY_CARD_EXPORT_HEIGHT = 1350

export type ReadyCardPngExport = {
  blob: Blob
  fileName: string
  width: typeof READY_CARD_EXPORT_WIDTH
  height: typeof READY_CARD_EXPORT_HEIGHT
}

export function exportReadyCardToPng(
  cardNode: HTMLElement,
  card: PublicReadyCard
): Promise<ReadyCardPngExport>
```

**Download helper**

```typescript
export function downloadBlob(blob: Blob, fileName: string): void
```

### 3. Contracts

- The export input is the current `QuietGalleryCard` DOM node plus the current `PublicReadyCard` for metadata such as the filename. Do not hand-recreate card layout in a parallel canvas implementation.
- Use the DOM-to-image path to capture the real card DOM/CSS so the downloaded PNG shares the same style source as the webpage card.
- The DOM-to-image output must be scaled to exactly `1080 × 1350` via export options such as `canvasWidth` and `canvasHeight`.
- The PNG must include the current sentence and either the same-origin WebP illustration or the CSS fallback illustration for `illustrationUrl: null` because both live inside the captured card DOM.
- The PNG must exclude page background, buttons, source metadata, watermark, prototype/debug UI, and action announcements by capturing only the card article node, not the page or action wrapper.
- Same-origin public illustration URLs may be captured by the DOM-to-image library; remote or unsafe URLs must not be introduced as an export strategy.
- Wait for `document.fonts.ready` when available, and wait for card `<img>` elements to load/decode before calling DOM-to-image so exported WebP cards do not miss the illustration.
- Download/share actions and refresh are mutually exclusive while any one of them is pending; do not let refresh mutate the card DOM while export is in flight, and do not export a transient `aria-busy`/refreshing card style.
- Browser download helpers should delay `URL.revokeObjectURL` long enough for the browser to consume the Blob URL; do not revoke on a zero-delay timer immediately after `anchor.click()`.
- Export failures must preserve the current 图文卡片, re-enable action buttons, and show non-technical retry copy.
- Production exporter modules must not expose test-only globals, callbacks, or debug probes. Browser tests should inject observation seams with Playwright `addInitScript` when they need to observe anchor clicks or blob URLs, but must not disable production cleanup behavior such as `URL.revokeObjectURL`.

### 4. Validation & Error Matrix

| Condition                                      | Required behavior                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Allowed download action and valid current card node | Generate one PNG download for the current card DOM.                         |
| Exported PNG is inspected in the browser       | Dimensions are exactly `1080 × 1350`.                                           |
| Exported PNG is compared with visible card     | Sampled card-style pixels remain close to the visible `QuietGalleryCard`.       |
| `illustrationUrl` is same-origin public WebP   | Wait for image load/decode; the captured card includes the real image from the public image route. |
| `illustrationUrl` is `null`                    | The captured card includes the CSS fallback illustration.                       |
| Refresh is pending                             | Download/share are disabled; do not export the transient refreshing card style. |
| Download/share is pending                      | Refresh is disabled; do not mutate the card DOM while export may be reading it. |
| Card node is missing, card image fails, or DOM-to-image returns no blob | Fail gracefully, keep the card visible, and re-enable controls. |
| Card-action gate returns `ready_card_limited`  | Do not call the exporter and do not trigger a browser download.                 |
| Test needs download/blob observability         | Inject test-only monkeypatches from Playwright while preserving production cleanup behavior. |

### 5. Good/Base/Bad Cases

- Good: after a refresh replaces the current card, `下载 PNG` captures the refreshed `QuietGalleryCard` DOM and uses the refreshed card id in the filename.
- Good: a stored WebP card exports through the same-origin public image route and still produces a 1080×1350 PNG.
- Base: a seed card with `illustrationUrl: null` exports the same CSS fallback art and sentence text visible on the page.
- Good: tests inspect the downloaded blob with `createImageBitmap` and compare sampled pixels against a screenshot of the visible card article.
- Bad: adding `window.__readyCardExportInputs` or a similar production global only so tests can inspect exporter input.
- Bad: hand-recreating card layout, gradients, typography, and wrapping in canvas; this drifts from the real `QuietGalleryCard` style.
- Bad: screenshotting `document.body` or a wrapper that can include controls, source metadata, prototype UI, or page background.

### 6. Tests Required

For PNG export work, use browser-visible tests that assert:

- Clicking `下载 PNG` reaches a Playwright `download` event after a successful card-action gate.
- The downloaded PNG decodes in the browser and has exact `1080 × 1350` dimensions.
- The downloaded PNG stays visually aligned with the visible `QuietGalleryCard` style by comparing it to a browser screenshot of the card article.
- A same-origin WebP illustration card is captured from the public image URL during export, including the case where the image request/decode is still pending when the user clicks download.
- A refreshed current card is exported instead of stale seed data.
- Refresh is disabled while download/share is pending, and download/share are disabled while refresh is pending.
- A `ready_card_limited` card-action response blocks PNG generation and produces no download event.
- Export failure leaves the current card visible, re-enables controls, and shows retry copy.
- Tests do not require production-only test globals; observation hooks live in the Playwright page context and must not bypass production Blob URL cleanup.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Production exporter polluted for tests.
declare global {
  interface Window {
    __readyCardExportInputs?: PublicReadyCard[]
  }
}
window.__readyCardExportInputs?.push(card)
```

```typescript
// Parallel layout implementation drifts from the real card CSS.
drawFallbackIllustration(context, card.accent)
drawSentence(context, card.sentence)
```

```tsx
// Captures too much and can include controls/source/prototype UI.
await htmlToImage.toPng(document.body)
```

#### Correct

```typescript
const blob = await toBlob(cardNode, {
  cacheBust: true,
  canvasWidth: READY_CARD_EXPORT_WIDTH,
  canvasHeight: READY_CARD_EXPORT_HEIGHT,
  pixelRatio: 1,
})
```

```typescript
// Test-only observability belongs in Playwright.
await page.addInitScript(() => {
  const originalClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function click() {
    if (this.download) window.__lastDownloadUrl = this.href
    return originalClick.call(this)
  }
})
```

---

## Required Patterns

- For route features, verify the route through browser-observable behavior when feasible.
- Keep prototype copy from implying future slices are already implemented.
- Use semantic elements (`main`, `section`, `article`, `nav`, `aside`) for page structure.
- For browser download/export behavior, observe downloads/blobs/canvas through Playwright-injected hooks rather than production test hooks.

---

## Forbidden Patterns

- No debug logging left in production-facing frontend code.
- No prototype-only controls rendered in production DOM.
- No copy that claims unavailable actions such as refresh/download/share before those slices implement them.
- No test-only globals, callbacks, or debug probes in production client modules.

---

## Code Review Checklist

- [ ] Linter passes.
- [ ] Type checker passes.
- [ ] Production build passes.
- [ ] Browser-visible acceptance criteria are checked through a browser tool or equivalent public interface when the route/control behavior is the public contract.
- [ ] Prototype/development affordances are absent from production output.
