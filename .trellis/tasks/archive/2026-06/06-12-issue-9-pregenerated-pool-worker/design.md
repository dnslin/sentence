# Design: pregenerated ready-pool worker

## First-principles reasoning

### Challenge assumptions

- Unverified assumption: the worker can be a one-off local script. ADR 0001 names a separate long-running `worker` service; a one-off script is useful for tests but is not the production shape.
- Unverified assumption: in-memory counters are enough for a daily cap. A process restart would reset memory, so that cannot enforce a real daily limit.
- Potentially wrong assumption: successful generation count is the same as ready inventory. The current canonical card upsert may update an existing sentence/style row, and failures do not create cards, so inventory must be measured from SQLite.
- Potentially wrong assumption: failed cards need a new `cards.status`. Current schema intentionally constrains `cards.status` to `ready`; failed/incomplete work belongs in generation/worker status records, not public ready-card rows.
- Potentially wrong assumption: concurrency is only an xAI client concern. The worker controls how many generation jobs are in flight; the xAI client only performs one image request per pipeline attempt plus the existing retry path.

### Bedrock truths

- A ready 图文卡片 is serveable only after a valid `cards.status = 'ready'` row points to a valid sentence and, for generated cards, a stored WebP public path.
- Users cannot be served incomplete cards if public repositories select only `ready` rows and failed attempts never create/update `cards` rows.
- A daily cap that survives process restart must be represented in durable storage.
- Image generation is the scarce/costly resource; the worker must serialize the generation path it controls.
- SQLite on one VPS can coordinate durable counters and inventory checks for this prototype without adding another service.

### Rebuild from ground up

1. Treat ready inventory as a database fact: count public-ready `cards` rows through a repository boundary.
2. Run a worker loop outside Next.js that periodically calls a single replenishment pass.
3. In each pass, if inventory is at least `50`, return a skipped summary and perform no generation.
4. If inventory is below `50`, reserve daily generation capacity from SQLite before starting each generation job.
5. Start exactly one generation job, await completion, record the outcome summary, then re-count inventory before deciding whether to continue.
6. Stop the pass when inventory reaches `200`, the cap is exhausted, a stop signal is observed, or a non-recoverable setup error occurs.
7. Keep failed attempts inspectable via `generation_attempts` and optional worker-run summaries, while public ready-card reads continue filtering only ready rows.

### Contrast with convention

A conventional cron-style batch might compute `target - current` once, launch that many async promises, and keep a process-local counter. That is suboptimal here because inventory and cap are shared durable facts: canonical upserts, failures, and restarts can invalidate the initial calculation. The essential difference is that this worker revalidates database facts after each serialized generation instead of trusting a stale in-memory plan.

### Conclusion

Implement a server-only worker module plus a CLI entrypoint. Use SQLite for inventory and cap accounting, keep generation jobs sequential, reuse the existing ready-card generation pipeline, and keep failed work out of `cards`.

## Architecture and boundaries

### New/changed modules

- `lib/worker/ready-pool-worker.ts`
  - Owns worker config constants and normalization.
  - Exposes one-pass replenishment for tests and a loop runner for the CLI.
  - Accepts injected `generateReadyCard`, `now`, `sleep`, and optional stop signal for deterministic tests.
  - Production default generator calls `generateReadyCardForHitokotoSentence(...)` with `createProductionXaiClient(...)`.
- `lib/worker/ready-pool-repository.ts`
  - Counts ready inventory.
  - Reserves daily generation capacity in SQLite.
  - Persists or reads worker/cap state as needed.
- `scripts/run-ready-pool-worker.ts`
  - Loads xAI config before constructing the production client.
  - Applies migrations before opening the shared database.
  - Runs the long-lived worker loop and handles `SIGINT` / `SIGTERM` by finishing the current generation before exit.
- `node-tests/ready-pool-worker.test.ts`
  - Uses controlled generator doubles and isolated SQLite databases.
  - Verifies threshold, target, concurrency, durable cap, and failure behavior.
- `package.json`
  - Adds `worker:ready-pool` for production execution.
  - Adds `test:worker` for focused Node worker tests.
- `lib/db/schema.ts` and `drizzle/*.sql`
  - Add durable worker/cap table(s).

### Proposed database shape

Use a compact daily reservation table:

```text
ready_pool_generation_days(
  day_key text primary key,
  generation_count integer not null check(generation_count >= 0),
  created_at integer not null,
  updated_at integer not null
)
```

Recommended `day_key` shape: UTC date string `YYYY-MM-DD` from the injected clock.

Reservation behavior:

```text
BEGIN IMMEDIATE
  read row for day_key
  if generation_count >= 250 -> return cap_exhausted
  insert/update generation_count = generation_count + 1
COMMIT
```

This makes cap state durable and restart-safe. The reservation happens before a worker generation job starts, so failures consume capacity. That is conservative and prevents retry loops from bypassing the cap.

The accepted cap boundary is the worker job reservation. The cap does not count each underlying provider image API call inside the existing xAI retry loop.

### Data flow

```text
worker CLI
  → apply migrations
  → create DatabaseClient
  → load xAI config + production xAI client
  → loop:
      → count ready inventory
      → skip if inventory >= 50
      → while inventory < 200:
          → reserve daily capacity
          → generateReadyCardForHitokotoSentence(...)
          → result ready: ready card exists in cards
          → result failed: failure remains in generation_attempts
          → re-count inventory
      → sleep until next interval
```

### Public worker contracts

Recommended TypeScript-level result contract:

```typescript
type ReadyPoolReplenishmentSummary = {
  startedInventory: number
  endingInventory: number
  threshold: 50
  target: 200
  dailyCap: 250
  generatedReadyCount: number
  failedCount: number
  reservedCount: number
  skippedReason: "inventory_above_threshold" | "daily_cap_exhausted" | "stopped" | null
}
```

The exact implementation can keep this internal to the worker module unless a later admin/status slice needs a public API.

### Configuration

Defaults should be constants, not scattered literals:

- `readyPoolReplenishThreshold = 50`
- `readyPoolTargetInventory = 200`
- `readyPoolDailyGenerationCap = 250`
- `readyPoolGenerationConcurrency = 1`
- `readyPoolWorkerIntervalMs`, recommended default: `60_000`

The loop interval may be environment-configurable for operations/tests, but threshold/target/cap should remain issue-defined constants for this slice unless a future task requires runtime tuning.

### Failure handling

- Controlled generator returns `status: "failed"`: count failure in the summary and re-check inventory; no ready card is added.
- Controlled/production generator throws: catch, sanitize for worker output, count as failed, re-check inventory, and continue until target/cap unless the error is configuration/setup before the loop starts.
- Existing pipeline failures that have an attempt row remain inspectable in `generation_attempts`.
- Worker output must not include secrets or raw base64.

### Compatibility and migration notes

- Do not weaken `cards.status` from `ready`; public ready-card code should remain unchanged except where inventory counting needs a shared helper.
- The new cap table is additive and safe to leave in place on rollback.
- Existing seed/mock cards count as ready inventory because they are public-ready rows.
- Existing e2e database reset must apply the new migration through `pnpm db:setup`.

### Operational and rollback considerations

- Future Docker Compose can point the worker service at `pnpm worker:ready-pool` without coupling it to `next start`.
- If the worker exits due to missing `XAI_API_KEY`, it should fail before opening a long-lived generation loop and print setup guidance without the secret.
- Rollback is straightforward: stop the worker script; the additive daily table does not affect web reads.
