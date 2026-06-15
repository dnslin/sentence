# [Slice 12] Web Share File Sharing Implementation Plan

## TDD Scenario List

Write tests vertically; each scenario gets RED → GREEN before moving to the next.

1. Supported Web Share file path sends `{ action: "share" }`, generates the current PNG artifact, calls `navigator.share` with one PNG `File`, and does not download.
2. Unsupported file sharing capability falls back to downloading the same 1080×1350 PNG artifact.
3. Share uses the refreshed current card instead of stale seed data.
4. `ready_card_limited` from `/api/card-action` blocks export, Web Share, and download while showing calm limit feedback.
5. Share/export failure preserves the current card, re-enables controls, and announces retry-oriented copy.
6. Existing download path still downloads the current complete card artifact.

## Execution Checklist

1. Confirm current task context and specs:
   - `python ./.trellis/scripts/task.py current`
   - frontend specs already read: `index.md`, `type-safety.md`, `quality-guidelines.md`, `component-guidelines.md`.
2. Pre-development context:
   - Run `trellis-before-dev` before editing implementation files.
3. RED #1:
   - Add Playwright-supported Web Share file test using `page.addInitScript` stubs.
   - Assert card-action request body, one PNG `File` passed to `navigator.share`, PNG dimensions, success copy, and no download event.
4. GREEN #1:
   - Add typed share helper for PNG `File` creation, capability check, and Web Share invocation.
   - Update `HomeCardExperience` share branch after card-action allow to export current card and call Web Share when supported.
5. RED/GREEN #2:
   - Add unsupported `canShare`/missing capability test.
   - Implement fallback to `downloadBlob(exported.blob, exported.fileName)` with clear fallback announcement.
6. RED/GREEN #3:
   - Add refreshed-current-card share test.
   - Ensure share export uses `currentCard` and `cardRef.current`, not initial props.
7. RED/GREEN #4:
   - Add/adjust gate blocked test for share so no export/share/download happens.
   - Ensure invalid/wrong action response also stops before export.
8. RED/GREEN #5:
   - Add share/export failure recovery test.
   - Ensure current card remains visible, controls re-enable, and retry copy is non-technical.
9. Refactor:
   - Keep React component orchestration shallow.
   - Remove duplicate test helpers where existing download inspection helpers can be reused.
   - Keep no `any`; use narrow test window types and local Web Share interfaces.
10. Run focused validation after green slices when practical:
    - `pnpm test:e2e -- --grep "share"`
11. Final validation:
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm build`
    - `pnpm test:e2e -- --grep "share|download"`
    - `pnpm test:e2e`
12. Quality check:
    - Dispatch Trellis check agent with active task path and changed files.
13. Spec update:
    - Update `.trellis/spec/frontend/quality-guidelines.md` only if implementation reveals a reusable Web Share/export contract worth preserving.
14. Finish:
    - Commit on `issue-13-web-share-file-sharing` only after checks pass and user-approved finish step is reached.

## Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e -- --grep "share"`
- `pnpm test:e2e -- --grep "share|download"`
- `pnpm test:e2e`

## Review Gates

- No `any` in new TypeScript or tests.
- No component-local duplicate API response or ready-card DTO types.
- `POST /api/card-action` remains the first boundary for `share`.
- Blocked/invalid action responses do not generate PNGs, call Web Share, or trigger downloads.
- Supported Web Share path uses a `File` built from the same exported PNG `Blob` and filename as download.
- Unsupported capability fallback uses `downloadBlob`, not a parallel download implementation.
- Share and download remain mutually exclusive with refresh while pending.
- Browser tests verify public behavior through page clicks and Playwright-injected browser API seams; production code has no test-only globals.

## Risk and Rollback Points

- `app/home-card-experience.tsx`: central action orchestration; rollback share branch to previous placeholder if Web Share behavior needs removal.
- `lib/card-export/share.ts`: new browser helper; keep isolated so rollback is deleting one module plus import sites.
- `tests/ready-card.spec.ts`: large integration file; use existing helper patterns and keep new helpers typed to avoid brittle global pollution.
- Web Share rejection after invocation must not trigger automatic download; preserve the card and show retry-oriented failure feedback.