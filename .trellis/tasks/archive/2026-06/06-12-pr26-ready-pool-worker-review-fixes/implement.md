# Implementation plan: PR 26 ready-pool worker review fixes

## TDD scenarios

Follow vertical red-green-refactor slices.

1. Thrown generator errors are visible and sanitized
   - RED: Add a worker test where the generator throws a secret-shaped error after reservation; assert `failedCount`, reserved count, sanitized error summary/reporting, and no secret leakage.
   - GREEN: Add sanitized error summary/reporting in `replenishReadyPoolOnce`.
2. Inventory growth metric handles canonical upsert/no-growth
   - RED: Add a test where generator returns `status: "ready"` without inserting a new card; assert ready-growth count stays 0 while reserved work/failure semantics remain clear and cap eventually stops.
   - GREEN: Compute ready growth from positive inventory deltas and update field name/spec/tests.
3. Remove redundant final count
   - RED: Add a test seam or use a counter around inventory counting if practical; otherwise refactor while preserving existing tests.
   - GREEN: Avoid final recount when `summary.endingInventory` is already current; keep skip/cap/stop paths accurate.
4. Shared public-ready eligibility
   - RED: Add/adjust tests to ensure worker count excludes the same invalid ready rows public serving excludes.
   - GREEN: Move count helper to ready-card repository or shared cards module and use it from worker.
5. Loop survives pass and observer errors
   - RED: Add loop tests with a failing replenishment dependency/sleep seam and throwing `onSummary`; assert subsequent iterations continue and errors are reported safely.
   - GREEN: Catch pass errors and observer errors inside `runReadyPoolWorkerLoop`.
6. Stop-aware sleep
   - RED: Add a loop test where stop occurs during sleep; assert loop exits without waiting for full interval.
   - GREEN: Implement stop-aware sleep/stop signal and wire CLI signal handlers.
7. CLI missing config returns naturally
   - RED/GREEN: Refactor script so missing config sets `process.exitCode` and does not call `process.exit()`; verify via typecheck/lint and, if practical, a small script-boundary test.
8. Remove unused concurrency constant
   - GREEN: Delete `readyPoolGenerationConcurrency` from code/spec and keep sequential behavior tests.
9. Spec update
   - Update backend database guidelines to match final contracts.

## Ordered checklist

- [ ] Update worker summary/error types and tests for thrown generation errors.
- [ ] Update inventory growth metric and tests for ready result without inventory growth.
- [ ] Refactor inventory count to shared public-ready helper.
- [ ] Remove redundant final count in normal path.
- [ ] Add loop-level error isolation and tests.
- [ ] Add stop-aware sleep/signal behavior and tests.
- [ ] Refactor CLI missing config path to natural return.
- [ ] Remove unused concurrency constant from code/spec.
- [ ] Update backend code-spec.
- [ ] Format changed files.

## Validation commands

- `pnpm test:worker`
- `pnpm test:xai`
- `pnpm test:hitokoto`
- `pnpm db:setup`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

## Risky files and rollback points

- `lib/worker/ready-pool-worker.ts`: loop behavior can affect production shutdown/retry semantics; keep tests deterministic.
- `scripts/run-ready-pool-worker.ts`: top-level ESM flow must remain valid after removing `process.exit()`.
- `lib/cards/ready-card-repository.ts` / `lib/worker/ready-pool-repository.ts`: shared count helper must not regress public selection behavior.
- `.trellis/spec/backend/database-guidelines.md`: update only the worker scenario to avoid conflicting with prior generation/storage contracts.

## Review gate before start

- PRD/design/implement exist.
- No open user decisions remain.
- Then run `python ./.trellis/scripts/task.py start .trellis/tasks/06-12-pr26-ready-pool-worker-review-fixes` and dispatch implementation/check agents.
