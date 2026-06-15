# [Slice 11] DOM-to-PNG Download Implementation Plan

## TDD Scenario List

Write tests vertically; each scenario gets RED → GREEN before moving to the next.

1. Download happy path emits a PNG download from the public homepage.
2. Downloaded PNG has exact 1080×1350 dimensions.
3. Download uses the current card after a refresh changes sentence/illustration state.
4. Rate-limited `POST /api/card-action` response blocks export and shows calm limit feedback.
5. Export failure keeps the current card, re-enables controls, and announces retry copy.
6. Share remains a truthful placeholder and does not trigger PNG export.
7. Exported artifact input excludes controls/source/prototype labels through the isolated exporter contract.

## Execution Checklist

1. Inspect current homepage/card/action implementation and existing Playwright patterns.
2. RED: add the first browser test for `下载 PNG` producing a download.
3. GREEN: add a typed canvas exporter and hook `下载 PNG` through card-action allow → PNG download.
4. RED/GREEN: add dimension assertion and make exporter constants exact 1080×1350.
5. RED/GREEN: add current-card-after-refresh scenario and ensure exporter receives `currentCard`.
6. RED/GREEN: add rate-limit blocked scenario and ensure no exporter/download runs.
7. RED/GREEN: add failure scenario and UI recovery.
8. RED/GREEN: assert share placeholder remains server-limited placeholder only.
9. Refactor: keep drawing, download, and UI orchestration separated; remove duplication.
10. Run focused tests after each green slice when practical.
11. Final validation: `pnpm lint`, `pnpm typecheck`, `pnpm build`, focused Playwright test(s), full `pnpm test:e2e`.
12. Dispatch Trellis quality check agent and address findings.
13. Update specs only if a new reusable convention is learned.
14. Commit changes on `issue-12-dom-to-png-download-flow`.

## Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e -- <focused test file or grep>`
- `pnpm test:e2e`

## Review Gates

- No `any` in new TypeScript.
- No component-local duplicate API response or ready-card DTO types.
- Exporter is not imported by Server Components.
- Browser tests verify public behavior, not private implementation.
- Download-blocked state does not create a PNG or success announcement.
- Share copy remains truthful placeholder copy.
