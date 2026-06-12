# Design: PR 26 ready-pool worker review fixes

## First-principles reasoning

### Challenge assumptions

- Wrong assumption: a worker can swallow thrown generation errors because the aggregate failed count is enough. The bedrock operational need is diagnosis; a consumed cap slot without a stage/message is not inspectable.
- Wrong assumption: the loop should crash on any pass error and rely on a supervisor. A supervisor is a last line of defense; the worker itself can keep running after recoverable SQLite/logging failures.
- Wrong assumption: setting `stopSignal.stopped = true` is enough for graceful shutdown. If the worker is sleeping, no code observes the flag until the timer resolves.
- Wrong assumption: `status='ready'` means inventory increased. The existing generated-card repository uses canonical upsert, so a ready result can update an existing row.
- Wrong assumption: documenting a constant proves behavior. If concurrency remains a fixed sequential invariant, an unused exported knob is misleading.

### Bedrock truths

- A reserved daily cap slot is consumed before generation starts; any post-reservation failure must be visible somewhere safe.
- Long-running workers must distinguish recoverable per-pass failures from fatal setup failures.
- Shutdown latency equals the maximum uninterruptible await duration in the loop.
- Ready inventory is the count of publicly serveable ready-card rows, not the count of successful generation results.
- Public-ready eligibility must have one source of truth or separate call sites will drift.

### Rebuild from ground up

1. Keep the one-pass replenishment function focused on deterministic inventory/cap behavior, but add structured summary fields for generation throws.
2. Count ready inventory before and after each generation; increment the ready-growth metric from positive inventory deltas, not from result status alone.
3. Move public-ready inventory counting to a shared ready-card repository helper and have worker code call that helper.
4. Make the long-running loop resilient: catch pass errors and observer errors, report sanitized error summaries, then wait for the next interval unless stopped.
5. Make sleeping stop-aware by passing stop state into an interruptible sleep function used by the CLI signal handlers.
6. Remove unused concurrency config and keep sequential behavior enforced by the loop and tests.
7. Update tests first for each fixed behavior, then implement.

### Contrast with convention

A conventional quick fix would add a few `console.error` calls around the loop. That would still leave inventory metrics inaccurate, sleep uninterruptible, and ready eligibility duplicated. The deeper fix is to align the worker contracts with the underlying facts: inventory deltas, shared eligibility, sanitized structured errors, and stop-aware waiting.

### Conclusion

Repair the worker at its public service boundary: structured summaries/errors, shared repository count, stop-aware loop lifecycle, accurate inventory growth, and matching specs/tests.

## Architecture and boundaries

### Worker summary contract

Update `ReadyPoolReplenishmentSummary` to include safe diagnostic detail for thrown generation errors, for example:

```typescript
type ReadyPoolErrorSummary = {
  stage: "generation_exception" | "replenishment_pass" | "summary_observer"
  message: string
}
```

The exact shape can be adjusted during implementation, but must be:

- Sanitized with existing `sanitizeErrorMessage`.
- JSON-serializable for CLI output.
- Free of secrets/raw base64.

### Inventory growth semantics

Prefer one of these compatible approaches:

- Keep `generatedReadyCount` but redefine it as actual positive ready inventory growth.
- Or rename to `readyInventoryGrowthCount` and update tests/spec accordingly.

Recommended: rename to `readyInventoryGrowthCount` to remove ambiguity.

### Shared ready eligibility

Move the ready-count query to `lib/cards/ready-card-repository.ts` or extract a helper near the ready-card repository so both public serving and worker counting use the same status/accent/join definition.

`lib/worker/ready-pool-repository.ts` should keep daily cap reservations only, or import the shared count helper instead of owning eligibility rules.

### Loop resilience

`runReadyPoolWorkerLoop(...)` should:

- Resolve `generateReadyCard` once.
- In each iteration, run `replenishReadyPoolOnce` inside a try/catch.
- Deliver normal summaries through `onSummary`, but catch observer failures.
- Report pass/observer errors through an optional `onError` or fallback `console.error` function.
- Continue to the next interval unless `stopSignal.stopped` is true.

### Stop-aware sleep

Recommended minimal interface:

```typescript
type ReadyPoolSleep = (input: {
  durationMs: number
  stopSignal?: ReadyPoolStopSignal
}) => Promise<void>
```

Default implementation should resolve early when the stop signal is triggered by the CLI. Because the current stop signal is a plain object, the CLI can use an `AbortController`-backed signal shape or expose a callback list. Keep the API simple and testable.

A simpler acceptable approach is to let `runReadyPoolWorkerLoop` receive a `sleep` test seam and implement an interruptible CLI sleep with an `AbortController`, as long as production SIGTERM wakes the sleep promptly and tests cover it.

### CLI setup

Change missing config path from:

```typescript
process.exitCode = 1
process.exit()
```

to natural top-level completion after setting `process.exitCode = 1`.

### Spec compatibility

Update `.trellis/spec/backend/database-guidelines.md` after implementation:

- Remove `readyPoolGenerationConcurrency` from constants.
- Document new summary/error fields.
- Document loop resilience and stop-aware sleep behavior.
- Update tests required.

## Compatibility and migration notes

- No new DB migration is expected for these fixes unless implementation chooses persistent worker error records. Prefer no migration: summary/log visibility is sufficient for this review task.
- Existing PR #26 migration and cap table remain unchanged.
- Existing public ready-card API payload must not change.
- Tests may need updates for renamed summary fields.

## Rollback considerations

- Changes are isolated to the PR #26 branch.
- If loop resilience causes test instability, keep one-pass replenishment deterministic and limit asynchronous behavior to loop-level tests.
- If renaming summary fields is too disruptive, keep the old field only if semantics are corrected and spec clarifies it.
