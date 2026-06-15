# [Slice 11] Add DOM-to-PNG download flow

## Goal

Implement the public 下载 PNG action so visitors can export the currently rendered 图文卡片 as a 1080×1350 PNG that contains the canonical illustration and 随机短句 while excluding site chrome, controls, source metadata, watermark, and prototype UI.

## User Value

Visitors can keep a shareable image artifact from the current 句画 visit without needing an account, saved history, or an external composition tool.

## Source Requirement

GitHub issue #12: `[Slice 11] Add DOM-to-PNG download flow`.

Issue acceptance requires:

- Clicking 下载 PNG exports the current complete 图文卡片.
- The output dimensions are 1080×1350.
- The export includes the illustration and sentence text.
- The export excludes buttons, page background, source metadata, watermark, and prototype UI.
- The export works with the chosen local font and public image URL strategy.
- Browser tests verify the download action reaches the expected behavior.

## Confirmed Facts

- Parent issue #1 is the 句画 MVP epic; this task is child Slice 11.
- Issue #11 is already merged into `master` and introduced server-side rate limiting plus `POST /api/card-action` for placeholder download/share action attempts.
- Current download/share UI must become truthful for download only: PNG download becomes implemented in this slice; share remains a placeholder until its owning slice.
- The visible 图文卡片 is rendered by the homepage client path `HomeExperience` → `HomeCardExperience` → `QuietGalleryCard`.
- Ready-card DTOs include a sentence, scene label, and `illustrationUrl: string | null`; a null illustration renders a CSS fallback that is still part of the current card.
- Browser-visible route behavior belongs in Playwright tests under `tests/`; no unit-test runner exists for React components.
- Strict TypeScript is required; untrusted browser boundary values must not be handled with `any`.

## Requirements

1. PNG export behavior
   - Clicking `下载 PNG` on the public homepage must generate and trigger a PNG download for the currently displayed 图文卡片.
   - The exported PNG must be exactly 1080×1350 pixels.
   - The export must represent one complete 图文卡片: illustration/fallback visual, sentence text, and card styling needed for the artifact.
   - The export must use the current card state after successful refreshes; it must not export stale seed data.

2. Export exclusions
   - The PNG must not include the page background, layout chrome outside the card, buttons, source metadata, watermark, prototype switcher/debug UI, or any browser-only live region text.
   - Source metadata may remain visible in the page if already present, but it must not be part of the export surface.

3. Asset and font handling
   - The export must work when `illustrationUrl` is a public same-origin WebP URL.
   - The export must also work for cards with `illustrationUrl: null` by exporting the card's fallback illustration.
   - Text rendering must use the app's chosen local/system font strategy consistently enough for browser export; no remote font dependency may be introduced for the export path.

4. User feedback and resilience
   - While export is being prepared, the download control must prevent duplicate concurrent exports and expose clear pending copy/state.
   - Successful export should announce calm completion copy.
   - Export failure must preserve the current 图文卡片, re-enable the control, and show non-technical retry-oriented copy.
   - Download rate-limit feedback from issue #11 must still be respected where applicable, without claiming success when the action is blocked.
   - Share placeholder behavior must remain truthful and unchanged except for any necessary shared action-state refactor.

5. Type safety and maintainability
   - Avoid `any`; prefer narrow types and explicit DOM/canvas guards at browser boundaries.
   - Keep export-specific code behind a small client-side module/function rather than scattering canvas serialization logic through UI components.
   - Reuse existing card DTO and UI components where possible; do not duplicate API response shape definitions locally.

6. Tests
   - Browser tests must verify that clicking `下载 PNG` reaches a download path.
   - Tests must verify output dimensions are 1080×1350.
   - Tests must verify the exported artifact includes sentence text and illustration/fallback visual evidence.
   - Tests must verify excluded UI/page elements do not appear in the export surface through an observable contract.
   - Tests must cover current-card behavior after refresh or mocked state change.
   - Existing refresh, rate-limit, and placeholder share behavior must keep passing.

## Acceptance Criteria

- [ ] `下载 PNG` exports the currently visible 图文卡片 as a PNG download.
- [ ] The downloaded PNG is exactly 1080×1350 pixels.
- [ ] The PNG includes the current sentence text and the card illustration/fallback visual.
- [ ] The PNG excludes page background, buttons, source metadata, watermark, and prototype/debug UI.
- [ ] The export succeeds for same-origin WebP illustrations and null-illustration fallback cards.
- [ ] The download button exposes pending/success/failure state, prevents duplicate concurrent exports, and preserves the current card on failure.
- [ ] The download action remains compatible with the rate-limit API introduced by issue #11; blocked downloads show calm limit feedback and do not generate a PNG.
- [ ] `分享` remains a truthful placeholder until its owning slice.
- [ ] Browser tests cover the download behavior and exported PNG dimensions/content contract.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, focused tests, and `pnpm test:e2e` pass.

## Out of Scope

- Real Web Share integration or share-file fallback; Slice 12 owns share behavior.
- Server-side image generation or storing exported PNGs.
- User accounts, saved export history, galleries, posting, or collections.
- Named living-artist visual style changes.
- Watermark introduction.

## Open Questions

- None. Use a client-side SVG/canvas export path unless repository inspection reveals an already accepted export utility.
