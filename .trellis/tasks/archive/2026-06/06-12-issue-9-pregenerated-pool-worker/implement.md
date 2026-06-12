# Implementation plan: issue 9 pregenerated ready-pool worker

## TDD scenarios

Follow vertical red-green-refactor slices. Do not write all tests first.

1. Below-threshold replenishment reaches target
   - RED: Add one `node:test` behavior that seeds 49 ready cards, runs one worker replenishment pass with a controlled generator, and asserts the worker starts generation and ends at 200 ready cards.
   - GREEN: Add inventory counting, worker config, one-pass replenishment, and a controlled generator seam.
   - REFACTOR: Extract inventory repository and summary types.
2. At-threshold inventory skips generation
   - RED: Seed 50 ready cards, run one pass, assert the controlled generator is never called and the summary reports an inventory skip.
   - GREEN: Add threshold guard.
3. Image generation concurrency stays at 1
   - RED: Use a controlled async generator that tracks active calls and assert max active calls is 1 during a below-threshold replenishment pass.
   - GREEN: Keep generation sequential and prevent overlapping loop ticks.
4. Daily cap stops generation and persists across restart
   - RED: Use an isolated database, run one pass with fewer remaining daily reservations than needed, close/reopen the client, run again on the same injected day, and assert no extra generation starts after the cap.
   - GREEN: Add the durable daily cap table, migration/schema, and reservation logic under `BEGIN IMMEDIATE`.
5. Failure behavior remains inspectable and non-ready
   - RED: Use a controlled generator that returns/records failed attempts for some jobs, assert failures are counted/inspectable and public ready inventory excludes them.
   - GREEN: Catch failed results, keep looping until target/cap, and avoid inserting ready cards for failures.
6. Independent CLI smoke contract
   - RED: Add a lightweight behavior around exported CLI setup helpers or script-visible config normalization where practical; otherwise rely on `pnpm typecheck` plus package-script existence.
   - GREEN: Add `scripts/run-ready-pool-worker.ts`, `worker:ready-pool`, migration-before-open, xAI config loading, signal handling, and safe output.

## Ordered checklist

- [ ] Add `ready_pool_generation_days` table to Drizzle schema and a committed SQL migration.
- [ ] Add ready-pool inventory/counting repository helpers using Drizzle.
- [ ] Add durable daily cap reservation helper with injected clock/day key.
- [ ] Add `lib/worker/ready-pool-worker.ts` with one-pass replenishment and loop runner.
- [ ] Add production generator wiring to `generateReadyCardForHitokotoSentence(...)` and `createProductionXaiClient(...)`.
- [ ] Add `scripts/run-ready-pool-worker.ts` as the independent worker entrypoint.
- [ ] Add `worker:ready-pool` and `test:worker` package scripts.
- [ ] Add `node-tests/ready-pool-worker.test.ts` and implement each scenario vertically.
- [ ] Update backend database guidelines/spec if the new worker/cap table becomes an accepted contract.
- [ ] Run formatting if needed.

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

- `drizzle/*.sql`, `lib/db/schema.ts`: migration/schema mistakes can break setup. Roll back table definition and migration together.
- `lib/worker/ready-pool-worker.ts`: loop bugs can over-generate or spin; keep one-pass logic testable and loop thin.
- `scripts/run-ready-pool-worker.ts`: production CLI must not leak secrets and must close SQLite on shutdown.
- `package.json`: script names are operational contracts for later deployment slices.
- Existing `lib/generation/xai-generation-pipeline.ts`: prefer reuse over modification; if daily cap is changed to provider-call accounting, the xAI retry boundary becomes a risky edit.

## Review gate before start

- PRD, design, and implementation plan exist.
- Daily-cap boundary decision is resolved: count worker job reservations, not each underlying provider image API call.
- User approves starting implementation from these artifacts.
- Then run `python ./.trellis/scripts/task.py start .trellis/tasks/06-12-issue-9-pregenerated-pool-worker` and load pre-development specs before editing.
