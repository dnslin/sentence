# Implementation Plan

## Scope

Verify the already-merged issue #2 implementation on `feat/issue-2-bootstrap-shell`. Implement only minimal fixes for acceptance gaps discovered during verification.

## First-Principles Basis

- The durable requirement is observable browser behavior, not redoing code that already exists.
- The raw repository facts show issue #2 is closed and HEAD contains the Slice 01 implementation.
- Extra implementation without a failed requirement increases regression surface without adding user value.
- Therefore the execution path is verification first, then TDD gap-fix only if a requirement fails.

## Ordered Checklist

1. Start the Trellis task after plan approval.
2. Run static quality checks:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm build`
3. Verify route-visible behavior through the app:
   - `/prototype` defaults to Quiet Gallery.
   - Valid variants select Quiet Gallery, Immersive Stage, and Paper Desk.
   - Missing, invalid, and repeated variants fall back to Quiet Gallery.
   - Non-production switcher is visible and separate.
   - Production output excludes the switcher label/control.
4. If any check fails, use TDD vertically:
   - capture the failing behavior as one public-interface check,
   - make the smallest implementation change,
   - rerun the failing check and then full validation.
5. Run Trellis quality check before finish.

## Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Browser/manual route checks against local app when needed.

## Risk and Rollback

- Risk: changing an already-delivered slice can regress the next slice baseline.
- Rollback: if a gap fix is wrong, revert only the minimal file change and keep the verification findings.
