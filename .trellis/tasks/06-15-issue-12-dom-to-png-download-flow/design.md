# [Slice 11] DOM-to-PNG Download Design

## First-Principles Reasoning

### Challenge assumptions

- Assumption: DOM-to-image requires a third-party package. This is unverified; the browser already has SVG, canvas, Blob, and download primitives.
- Assumption: the exported PNG must be a screenshot of the live DOM. Potentially wrong; the requirement is an exported artifact matching the current 图文卡片 and excluding non-card chrome.
- Assumption: rate-limit placeholder endpoint must still be called before download. Verified by issue #11 compatibility: download attempts are server-limited and blocked attempts must not claim success.
- Assumption: tests need OCR to prove text exists in the PNG. Unverified and likely brittle; a test-only observable export seam can verify dimensions and source data without decoding glyphs.
- Assumption: WebP illustrations require CORS work. For same-origin public URLs, canvas/image loading can remain same-origin; remote images are not part of the accepted strategy.

### Bedrock truths

- A PNG file is a byte artifact; browsers can produce one from a canvas using `canvas.toBlob("image/png")`.
- A canvas has exact pixel dimensions; a 1080×1350 canvas produces a 1080×1350 PNG when encoded.
- Canvas drawing can include raster images, vector/fallback shapes, and text if fonts are available to the browser.
- Browser download is observable through an `<a download>` click or Playwright's `download` event.
- The live page contains elements that must be excluded; the simplest way to guarantee exclusion is to render only the export artifact into an isolated canvas, not screenshot a larger DOM subtree.
- Strict TypeScript can model the exporter input as the existing `PublicReadyCard` plus narrow options; DOM APIs need null checks and typed failures.

### Rebuild from truths

Build a client-only exporter that accepts the current `PublicReadyCard`, checks the rate-limit endpoint first, then renders an isolated 1080×1350 canvas from the card data. The exporter draws a deterministic card surface: background, illustration region from same-origin WebP or fallback vector shapes, and sentence text with line wrapping. Since only card data is drawn, controls/source/page/prototype UI cannot enter the PNG. The UI component owns pending/success/failure state and calls a small download helper that turns the PNG Blob into an object URL and clicks a temporary download link.

### Contrast with convention

Conventional DOM screenshot libraries clone a DOM node and serialize styles. That may appear faster, but it expands the trust surface: external CSS, unsupported styles, hidden children, and accidental inclusion of metadata/control nodes. The isolated canvas path is more direct from the requirement: exact pixels and a bounded artifact surface.

### Conclusion

The fundamental requirement is not "capture arbitrary DOM"; it is "produce a correct PNG artifact for one current 图文卡片". A typed canvas exporter fed by the current card DTO is the smallest reliable boundary that gives exact dimensions, strict exclusions, same-origin image control, and testable behavior.

## Architecture

### Public flow

1. User clicks `下载 PNG` in `HomeCardExperience`.
2. UI disables download/share action buttons for the active export attempt and announces pending copy.
3. Client calls `POST /api/card-action` with `{ action: "download" }` to preserve issue #11 rate-limit semantics.
4. If endpoint returns `ready_card_limited`, UI announces calm limit copy and stops.
5. If endpoint allows the action, client calls `exportReadyCardToPng(currentCard)`.
6. Exporter returns a `Blob` and metadata `{ width: 1080, height: 1350, fileName }`.
7. Download helper creates an object URL and clicks a temporary `<a download>`.
8. UI announces success or non-technical failure.

### Module boundaries

- `lib/card-export/png.ts`
  - Client-safe, no React.
  - Owns export dimensions, rendering constants, image loading, text wrapping, canvas-to-blob conversion, and filename generation.
  - Exposes `exportReadyCardToPng(card: PublicReadyCard, options?: ExportOptions): Promise<ReadyCardPngExport>`.
- `lib/card-export/download.ts`
  - Client-safe browser download helper.
  - Exposes `downloadBlob(blob, fileName)`.
- Existing shared API contracts in `lib/card-actions` / ready-card response modules remain the source of truth for endpoint guards.
- `HomeCardExperience` orchestrates UI state and calls exporter, but does not contain drawing logic.
- Playwright tests exercise the homepage through browser clicks and use `pngjs` or an equivalent parser only if already available; otherwise add a lightweight dev dependency or use browser `createImageBitmap`/canvas inspection on downloaded bytes.

### Export surface

- Canvas size: `1080 × 1350`.
- Export includes:
  - Card background/artifact shape.
  - Illustration region from `illustrationUrl` when present.
  - Fallback illustration shapes when `illustrationUrl` is null or image loading fails in a controlled fallback path.
  - Sentence text.
- Export excludes by construction:
  - Buttons and page controls.
  - Source metadata.
  - Watermark.
  - Page background and site chrome.
  - Prototype switcher/debug UI.

### Error handling

- Rate-limit blocked response: do not export; show endpoint message or calm fallback.
- Invalid card-action success/failure payload: show retry-oriented failure copy.
- Canvas context unavailable, image load error with no fallback, or PNG blob creation failure: throw typed `ReadyCardExportError`; UI catches and announces retry copy.
- Blob URL revocation happens after link activation to avoid leaking object URLs.

### Compatibility

- The exporter runs only in client event handlers; no server component imports browser-only modules.
- Same-origin WebP public URLs can be drawn to canvas. The code sets `crossOrigin` only when safe and avoids remote image strategies.
- Null illustration cards export fallback art, preserving existing seed behavior.
- Share remains a placeholder action using existing server action flow.

## Data and Type Contracts

```ts
export const READY_CARD_EXPORT_WIDTH = 1080
export const READY_CARD_EXPORT_HEIGHT = 1350

export type ReadyCardPngExport = {
  blob: Blob
  fileName: string
  width: 1080
  height: 1350
}
```

`PublicReadyCard` remains the input contract. No component-local duplicate card response types.

## Test Strategy

Requirement-driven scenarios:

1. Happy path: clicking `下载 PNG` after an allowed action produces one PNG download.
2. Dimension: downloaded PNG dimensions are exactly 1080×1350.
3. Content: the export is generated from the current card sentence and illustration/fallback visual.
4. Exclusions: export metadata/test seam confirms no buttons/source/prototype labels are part of the render input; visual export contains only the isolated artifact surface.
5. Current state: after a mocked refresh changes the current card, download exports the new sentence/card.
6. Rate limit: a `429 ready_card_limited` card-action response prevents PNG generation and announces calm copy.
7. Failure: exporter/download failure preserves current card and re-enables action.
8. Regression: share placeholder still calls `POST /api/card-action` and does not invoke PNG export.

## Rollback

Remove the `lib/card-export/` modules and revert `HomeCardExperience` download orchestration/tests; the existing placeholder endpoint remains from issue #11.
