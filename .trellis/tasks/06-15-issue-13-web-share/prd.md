# [Slice 12] Add Web Share file sharing with download fallback

## Goal

Implement the public `分享` action so visitors on browsers with Web Share file capability can share the same generated PNG artifact as `下载 PNG`, while unsupported browsers fall back to downloading that PNG.

## User Value

Visitors can move the current 图文卡片 into the platform share surface when their browser supports file sharing, and still keep the same shareable artifact through PNG download when file sharing is unavailable.

## Source Requirement

GitHub issue #13: `[Slice 12] Add Web Share file sharing with download fallback`.

Issue acceptance requires:

- Browsers with supported Web Share file capability can share the current PNG card.
- Unsupported browsers fall back to the download flow.
- The user receives consistent loading and fallback feedback.
- The shared/downloaded file represents the complete 图文卡片.
- Tests cover supported and unsupported browser capability paths.

## Confirmed Facts

- Parent issue #1 is the 句画 MVP epic; this task is child Slice 12.
- Slice 11 / issue #12 is already merged into the current history and implemented DOM-to-PNG download using `exportReadyCardToPng(cardNode, currentCard)` plus `downloadBlob`.
- The existing download artifact is a `Blob` with filename metadata and exact dimensions from `lib/card-export/png.ts`.
- `HomeCardExperience` already gates both `download` and `share` through `POST /api/card-action` and disables refresh/download/share while any one card action is pending.
- `share` currently remains a truthful placeholder after the card-action gate.
- The visible 图文卡片 is rendered by `QuietGalleryCard`, and the export captures the card article DOM node so the PNG includes the current sentence and illustration/fallback while excluding page controls.
- Browser-visible route behavior belongs in Playwright tests under `tests/`; no React unit-test runner exists.
- Strict TypeScript is required; untrusted browser/API capability values must be narrowed without `any`.

## Requirements

1. Share artifact behavior
   - Clicking `分享` on the public homepage must first call `POST /api/card-action` with `{ action: "share" }` and require a valid echoed allowed response before generating or sharing/downloading a PNG.
   - For browsers where `navigator.share` exists and `navigator.canShare({ files: [file] })` confirms file sharing for the generated PNG, the app must share the current 图文卡片 PNG through Web Share API.
   - The shared file must be constructed from the same PNG `Blob` and filename produced by the download export path.
   - The share target metadata should stay product-truthful and generic: a short title/text that describes one current 图文卡片, without accounts, saved history, galleries, or named living-artist style language.

2. Download fallback behavior
   - If file sharing is unavailable before invoking system share, the app must fall back to the existing download flow using the same exported PNG artifact.
   - Unsupported capability includes missing `navigator.share`, missing `navigator.canShare`, or `navigator.canShare({ files: [file] })` returning false for the PNG file.
   - Fallback must reuse `downloadBlob` rather than implementing a separate download path.

3. Current card and artifact completeness
   - The shared/downloaded PNG must represent the currently displayed 图文卡片, including refreshed card state.
   - The PNG must preserve existing Slice 11 export contracts: exact 1080×1350 dimensions, current sentence, illustration or CSS fallback, card styling, and exclusion of page background, controls, source metadata, watermark, prototype/debug UI, and live-region announcements.

4. User feedback and resilience
   - While share is preparing, refresh/download/share must remain mutually exclusive and disabled with clear pending copy/state.
   - A successful Web Share path should announce calm completion copy after `navigator.share` resolves.
   - A fallback download path should announce that sharing was unavailable and that the PNG download is starting.
   - A blocked card-action response must preserve the current 图文卡片, show calm limit copy, and must not generate or share/download a PNG.
   - Invalid gate responses, export failures, share failures, or download fallback failures must preserve the current 图文卡片, re-enable controls, and show non-technical retry copy.

5. Type safety and maintainability
   - Avoid `any`; model Web Share file capability through narrow local interfaces or global type augmentation compatible with TypeScript DOM typings.
   - Keep share capability/file construction behind small client-side helpers instead of embedding browser API probing throughout the component.
   - Reuse existing `PublicReadyCard`, card-action guards, `exportReadyCardToPng`, and `downloadBlob` contracts.

6. Tests
   - Browser-visible tests must cover Web Share supported and unsupported capability paths.
   - Tests must verify `POST /api/card-action` is still sent with `{ action: "share" }` before share/export work begins.
   - Tests must verify the supported path calls Web Share with a PNG `File` representing the current complete card artifact and does not trigger a browser download.
   - Tests must verify the unsupported path falls back to PNG download using the same 1080×1350 artifact contract.
   - Existing download, refresh, rate-limit, and export completeness tests must keep passing.

## Acceptance Criteria

- [ ] `分享` calls `POST /api/card-action` with `{ action: "share" }` and proceeds only after a valid allowed response echoing `share`.
- [ ] Browsers with Web Share file capability receive a PNG `File` generated from the current 图文卡片 and share it through `navigator.share`.
- [ ] Unsupported browsers fall back to the existing PNG download flow.
- [ ] The shared/downloaded PNG is the same complete 1080×1350 图文卡片 artifact produced by the download exporter.
- [ ] Current refreshed card state is shared/downloaded rather than stale seed data.
- [ ] Pending, success, fallback, limit, and failure feedback are consistent and non-technical.
- [ ] Refresh/download/share remain mutually exclusive while share/export is pending.
- [ ] Blocked or invalid card-action responses do not generate a PNG, call Web Share, or trigger a download.
- [ ] Browser tests cover supported Web Share file capability and unsupported fallback paths.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, focused Playwright checks, and `pnpm test:e2e` pass.

## Out of Scope

- Server-side exported PNG storage.
- Share history, account features, galleries, posting, collections, or permanent saved records.
- Sharing remote image URLs instead of a generated PNG file.
- Replacing the existing DOM-to-PNG exporter with a parallel rendering implementation.
- Named living-artist visual style copy.
- Native-app specific customization beyond standards-based Web Share API fields.

## Open Questions

- None.

## Product Decisions

- Fallback download happens only when file sharing is unavailable before opening the system share sheet. After `navigator.share` is invoked, user cancellation or runtime rejection preserves the current 图文卡片 and shows non-technical failure feedback; it must not automatically download the PNG.