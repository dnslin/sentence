# [Slice 12] Web Share File Sharing Design

## First-Principles Reasoning

### Challenge assumptions

- Assumption: implementing `分享` needs a separate artifact pipeline. Potentially wrong; Slice 11 already produces the required PNG artifact from the real card DOM.
- Assumption: Web Share support can be checked by `navigator.share` alone. Wrong for file sharing; browsers may support URL/text share but reject `files` unless `navigator.canShare({ files })` returns true.
- Assumption: fallback means always download after any share failure. Unverified; once a system share sheet opens, rejection may mean user cancellation rather than unsupported capability.
- Assumption: tests must use a real OS share sheet. Wrong; browsers expose `navigator.share` as a public interface and Playwright can install controlled capability stubs before page code runs.
- Assumption: the `share` server gate can be skipped because sharing is client-only. Wrong; existing rate-limit contracts require both public card actions to call `POST /api/card-action` before the action proceeds.

### Bedrock truths

- A shared file through Web Share API must be a `File` object, not just a `Blob`; `File` carries a name and MIME type.
- The existing exporter returns the current card's PNG `Blob` and filename; this is sufficient to construct a `File` with `type: "image/png"`.
- `navigator.canShare({ files: [file] })` is the browser capability check for Web Share files; unsupported browsers either lack `navigator.share`, lack `navigator.canShare`, or return false.
- The only artifact that satisfies issue #13 is the same complete PNG already validated by Slice 11: 1080×1350, current card DOM, and no page controls.
- The UI must not let refresh mutate the DOM while export/share is reading it; the existing `isCardBusy` state is the mutual-exclusion primitive.
- Browser APIs are optional at runtime, so strict TypeScript needs explicit narrowing around `navigator` methods and `File` creation.

### Rebuild from truths

1. Keep `POST /api/card-action` as the first action boundary for `share`.
2. After a valid `share` allow response, export the current `QuietGalleryCard` article through `exportReadyCardToPng(cardRef.current, currentCard)`.
3. Convert the returned PNG `Blob` into a `File` using the returned filename and MIME type.
4. Check Web Share file capability with that exact `File`.
5. If supported, call `navigator.share({ files: [file], title, text })` and announce success when it resolves.
6. If unsupported before invoking share, call `downloadBlob(exported.blob, exported.fileName)` and announce fallback download.
7. On gate/export/share errors, keep the current card visible and re-enable controls with retry-oriented copy.

### Contrast with convention

A conventional share implementation might share a URL first and treat file sharing as a progressive enhancement later. That misses the issue's artifact truth: the current 图文卡片 is a generated image, not a route URL or gallery item. The fundamental contract is one PNG file artifact, so Web Share and fallback download must branch only after that artifact exists.

### Conclusion

The simplest correct design is one shared PNG export pipeline with two delivery mechanisms: Web Share file when `navigator.canShare` confirms support, otherwise the existing PNG download helper. The component remains an orchestrator; artifact generation and browser delivery stay in small typed modules.

## Architecture and Boundaries

### Existing modules reused

- `app/home-card-experience.tsx`
  - Owns user event orchestration, pending state, announcements, and the `QuietGalleryCard` ref.
  - Continues to call `POST /api/card-action` before public actions.
- `lib/card-export/png.ts`
  - Produces the current complete `ReadyCardPngExport` from the card DOM node and `PublicReadyCard`.
- `lib/card-export/download.ts`
  - Triggers fallback PNG download from the exported Blob.
- `lib/cards/public-ready-card.ts`
  - Remains the source of card-action DTOs, guards, and `PublicReadyCard`.

### New/updated browser helper boundary

Add a small client-safe helper, likely under `lib/card-export/share.ts`, with contracts shaped like:

```ts
export type ReadyCardShareFile = {
  file: File
  fileName: string
}

export type WebShareFilePayload = {
  file: File
  title: string
  text: string
}

export function createReadyCardShareFile(exportedCard: ReadyCardPngExport): ReadyCardShareFile
export function canShareReadyCardFile(payload: WebShareFilePayload): boolean
export function shareReadyCardFile(payload: WebShareFilePayload): Promise<void>
```

Exact names can change during implementation, but the boundary should keep Web Share probing and `File` creation out of the React component.

### Data flow

1. User clicks `分享`.
2. `HomeCardExperience` sees `isCardBusy === false`.
3. UI sets `pendingCardAction` to `share` and announces preparing copy.
4. Client posts `{ action: "share" }` to `/api/card-action`.
5. Non-OK/invalid responses stop the flow and announce existing card-action limit/failure copy.
6. Valid echoed allow response exports `cardRef.current` with `currentCard`.
7. Export result becomes a PNG `File`.
8. Capability branch:
   - supported: `navigator.share({ files: [file], title, text })`, no download.
   - unsupported before invocation: `downloadBlob(exported.blob, exported.fileName)`.
9. UI announces share success or fallback download.
10. `pendingCardAction` resets in `finally`.

### User feedback contract

- Pending share: keep existing button copy style (`分享确认中`) or update to `分享准备中`; controls are disabled by `isCardBusy`.
- Supported success: e.g. `已打开系统分享，图文卡片 PNG 已交给浏览器处理。`
- Unsupported fallback: e.g. `当前浏览器不支持直接分享文件，PNG 会开始下载。`
- Gate limit: reuse `cardActionLimitAnnouncement`.
- Export/share failure: reuse or specialize a non-technical share failure announcement.

### Compatibility notes

- Web Share API is available only in secure contexts on supported browsers; local/test stubs can emulate it.
- The app must check file capability with the actual PNG `File`, not a guessed MIME string.
- `File` may not exist in non-browser environments, so helper code must be called only from client event handlers or guard runtime access.
- The project remains Next.js App Router with no server import of browser-only helper code.

### Error handling matrix

| Condition | Behavior |
| --- | --- |
| Card-action returns valid allowed `share` | Export current card, then share or fallback download. |
| Card-action returns `ready_card_limited` | Announce calm limit copy; no export, share, or download. |
| Card-action returns invalid success payload or wrong action | Treat as failure; no export/share/download. |
| Card ref is missing or export fails | Preserve current card, announce share failure, re-enable controls. |
| Web Share file capability unsupported before invocation | Download the exported PNG through `downloadBlob`; announce fallback. |
| Web Share resolves | Announce share success; no download. |
| Web Share rejects after invocation | Preserve current card and announce non-technical share failure; do not automatically download because the share sheet was already opened and rejection may be user cancellation. |

## Test Strategy

Requirement-driven Playwright scenarios:

1. Supported capability path:
   - Install `navigator.canShare` and `navigator.share` stubs with `page.addInitScript`.
   - Click `分享`.
   - Assert `/api/card-action` receives `{ action: "share" }`.
   - Assert `navigator.share` receives one PNG `File` with expected filename/type and dimensions decoded via browser APIs.
   - Assert no download event fires.

2. Unsupported fallback path:
   - Install stubs where `navigator.canShare({ files })` returns false or remove file share support.
   - Click `分享`.
   - Assert a Playwright download event fires.
   - Decode the downloaded PNG and assert 1080×1350 dimensions using the existing helpers.
   - Assert fallback copy appears.

3. Current-card path:
   - Mock refresh to return a known card.
   - Click `分享` with supported Web Share stubs.
   - Assert shared file filename includes the refreshed card id and the visible sentence is the refreshed one.

4. Gate blocked path:
   - Fulfill `/api/card-action` with `429 ready_card_limited`.
   - Assert no Web Share call and no download event.
   - Assert calm limit copy and controls re-enable.

5. Failure path:
   - Force export failure (for example a broken same-origin image as in download tests) or reject `navigator.share`.
   - Assert current card remains visible, controls re-enable, and retry-oriented copy appears.

6. Regression path:
   - Existing download/export tests continue to pass, proving the shared artifact pipeline was not forked or weakened.

## Rollback

Revert the share helper and `HomeCardExperience` share branch to the placeholder behavior while leaving Slice 11 download modules intact. Tests added for Web Share should be removed or skipped only with issue #13 explicitly rolled back.