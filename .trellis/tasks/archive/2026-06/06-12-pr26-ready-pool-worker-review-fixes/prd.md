# Fix PR 26 ready-pool worker review findings

## Goal

Address the confirmed PR #26 code-review findings for the pregenerated ready-pool worker so the worker is safer in production, easier to operate, and consistent with the backend code-spec.

## Source review

- Target PR: https://github.com/dnslin/sentence/pull/26
- Review request: max-recall `/code-review PR #26`
- Confirmed findings to fix, in priority order:
  1. Thrown generator errors are swallowed without persisted or logged details after consuming daily capacity.
  2. Long-running worker loop lets replenishment-pass infrastructure errors terminate the entire worker.
  3. Worker shutdown can be delayed by the full sleep interval because sleep cannot be interrupted by SIGTERM/SIGINT.
  4. `generatedReadyCount` counts ready generator results rather than actual inventory growth.
  5. Missing `XAI_API_KEY` path calls `process.exit()` directly.
  6. `onSummary` observer failures are not isolated from the worker loop.
  7. Ready-pool inventory duplicates public ready-card eligibility instead of sharing it.
  8. `readyPoolGenerationConcurrency` is exported/documented but not used.
  9. Successful replenishment pass performs a redundant final inventory count.

## Confirmed facts

- PR #26 is open on branch `issue-9-pregenerated-pool-worker` and currently includes the ready-pool worker implementation and backend code-spec.
- Existing worker tests cover threshold, target, durable cap, concurrency, and failed generation result behavior, but not thrown generator errors, loop-level infrastructure errors, observer isolation, interruptible sleep, or duplicate upsert inventory deltas.
- `generateReadyCardForHitokotoSentence(...)` can throw before `createGenerationAttempt(...)`, because Hitokoto fetch/store happens first.
- Current worker CLI validates `XAI_API_KEY` before migration and DB open, but exits by calling `process.exit()`.
- Current worker loop uses `await sleep(readyPoolWorkerIntervalMs)` with a default `setTimeout` promise that does not react to `stopSignal`.
- Current worker inventory count repeats the public ready-card SQL predicate instead of using a shared repository helper.

## Requirements

1. Preserve visible failure details for thrown generator errors.
   - A thrown generation error after reserving daily capacity must be represented in the worker summary with sanitized diagnostic detail.
   - The worker must not leak secrets, raw base64, or provider credentials in summary output.
   - The worker should continue re-counting inventory and proceed according to cap/target/stop rules after a thrown generation error.
2. Keep the long-running worker alive across recoverable pass/observer failures.
   - A transient infrastructure error inside one replenishment pass must not permanently terminate the worker loop.
   - `onSummary` failures must be isolated from generation and the next loop iteration.
   - Failures should be reported through a safe error-reporting hook or fallback logger.
3. Make shutdown prompt during idle sleep.
   - SIGINT/SIGTERM-triggered stop state must wake the sleeping worker without waiting the full `60_000ms` interval.
   - SQLite still closes through the script `finally` block.
4. Make summary counters semantically accurate.
   - Replace or redefine `generatedReadyCount` so it represents actual ready-inventory growth, not merely ready generation results.
   - Tests must cover canonical upsert/no-inventory-growth behavior.
5. Avoid direct `process.exit()` in the worker CLI missing-config path.
   - Missing `XAI_API_KEY` should set a non-zero exit code and let the module return naturally.
6. Share ready-card eligibility logic.
   - Extract a shared ready-card eligibility predicate/count helper or otherwise make worker counting reuse the public-ready definition from the ready-card repository area.
   - Do not drift from public ready-card serving semantics.
7. Remove misleading unused concurrency configuration.
   - Delete `readyPoolGenerationConcurrency` from code and code-spec unless it becomes a real implementation input.
   - Concurrency 1 remains enforced by the sequential loop and tests.
8. Remove redundant final inventory count.
   - Avoid duplicate SQLite count on normal target-reaching paths while keeping accurate final `endingInventory` on skip/cap/stop/error paths.
9. Update tests and specs.
   - Add behavior tests for the newly fixed failure/shutdown/summary semantics.
   - Update `.trellis/spec/backend/database-guidelines.md` so it matches the final worker contract.

## Acceptance Criteria

- [ ] Thrown generator errors after reservation are counted, sanitized, and visible in worker summary/error reporting without leaking secrets.
- [ ] Recoverable replenishment-pass errors do not permanently terminate `runReadyPoolWorkerLoop`.
- [ ] `onSummary` throwing does not terminate the worker loop.
- [ ] Stop during idle sleep exits promptly instead of waiting `readyPoolWorkerIntervalMs`.
- [ ] Missing `XAI_API_KEY` path no longer calls `process.exit()` directly.
- [ ] Ready inventory count uses shared public-ready eligibility logic.
- [ ] Summary ready-generation metric reflects actual inventory delta or is renamed to remove the false implication.
- [ ] Canonical upsert / duplicate-ready result scenario is covered by tests.
- [ ] `readyPoolGenerationConcurrency` is removed from code/spec or wired to behavior; preferred outcome is removal.
- [ ] Normal successful replenishment does not perform an unnecessary extra final inventory count.
- [ ] Backend code-spec reflects the final worker signatures, contracts, validation matrix, and tests.
- [ ] `pnpm test:worker`, `pnpm test:xai`, `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

## Out of scope

- Changing the accepted daily cap boundary; it remains worker job reservations before generation calls.
- Docker Compose production service wiring.
- Adding a new admin dashboard or public worker-status API.
- Changing Hitokoto/xAI provider behavior outside what is needed for worker failure visibility.

## Open questions

None blocking. Fix all confirmed review findings with the simplest compatible implementation.
