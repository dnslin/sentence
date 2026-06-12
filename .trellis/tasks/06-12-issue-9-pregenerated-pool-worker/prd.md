# Add pregenerated pool worker with inventory thresholds and daily cap

## Goal

Add the independent ready-pool worker for 句画 so the web process can keep serving pregenerated 图文卡片 from SQLite/WebP storage while a separate background process replenishes inventory when the ready pool is low.

## Source issue

- GitHub issue: https://github.com/dnslin/sentence/issues/9
- Parent: #1
- Blocker: #8 is complete in the current branch history.

## Confirmed facts

- ADR 0001 requires separate `web` and `worker` services from the same Next.js/Node image on a single VPS.
- ADR 0002 requires a hybrid pregenerated ready-card pool that replenishes when ready inventory drops below `50` and targets around `200` ready 图文卡片.
- ADR 0003 requires SQLite WAL for metadata/rate-limit/generation status and local WebP files for generated illustrations.
- The current public ready-card store uses `cards.status = 'ready'`; failed/incomplete generations are not represented as cards and therefore are excluded from ready-card selection by existing repository filters.
- The current generation pipeline exposes `generateReadyCardForHitokotoSentence(...)`, which fetches a Hitokoto 随机短句, generates one 非署名绘本风 illustration through the injectable xAI boundary, stores a WebP, and only then upserts a ready `cards` row.
- Existing generation failures are persisted in `generation_attempts.status = 'failed'` with sanitized `error_stage` / `error_message` when the pipeline reaches an attempt row.
- Existing Node behavior tests live under `node-tests/` and use controlled external-service doubles for Hitokoto/xAI. Browser e2e tests remain under `tests/`.
- `package.json` currently has focused `test:hitokoto` and `test:xai` scripts, but no worker test script yet.

## Requirements

1. Provide an independent worker entrypoint.
   - The worker must run without the Next.js web process.
   - It must open its own SQLite connection and use the existing production Hitokoto/xAI generation path in production.
   - It must be invokable through a package script suitable for a future Docker Compose `worker` service.
2. Replenish only when ready inventory is below the threshold.
   - Threshold: `50` ready cards.
   - Target: `200` ready cards.
   - Inventory means rows visible to the public ready-card pool: `cards.status = 'ready'` with repository-valid ready-card fields.
   - When inventory is `50` or higher, the worker must not start generation work.
3. Replenish toward the target without overshooting by design.
   - When inventory is below `50`, the worker should keep generating until ready inventory reaches `200`, the daily cap is exhausted, or the worker is stopped.
   - Failed generations must not be counted as ready inventory.
   - The worker must re-check inventory as generation completes so canonical upserts or failures cannot falsely advance the ready count.
4. Limit image generation concurrency to `1`.
   - The worker must not run more than one ready-card generation job at a time in a single worker process.
   - Long-running loop ticks must not overlap; a slow generation pass must finish or stop before another pass starts.
5. Enforce a daily generation cap of `250`.
   - Cap state must be durable in SQLite, not in process memory, so restarts do not reset the same day.
   - Tests must use an injected clock/day boundary so cap behavior is deterministic.
   - Open decision: whether the cap counts worker generation-job reservations or each underlying provider image API call.
6. Keep failures visible and excluded from ready results.
   - Pipeline-level failures must remain inspectable through persisted generation/worker status records with sanitized messages.
   - Failed or incomplete generations must not create or update public ready `cards` rows.
   - Worker summaries/log output must include counts of ready, failed, cap-exhausted, and skipped outcomes without printing secrets.
7. Follow strict TypeScript type safety.
   - External services, time, worker config, database rows, and CLI environment values must be normalized at clear boundaries.
   - Controlled doubles used by tests must satisfy the public TypeScript interfaces instead of relying on `any` or unsafe casts.
8. Follow vertical TDD.
   - Add one public-interface behavior test, implement the minimal production path for that behavior, then proceed to the next behavior.
   - Tests should verify behavior through the worker service/entrypoint boundary and controlled external-service doubles, not private helper internals.

## Acceptance Criteria

- [ ] A package script can run the ready-pool worker independently from the Next.js web server.
- [ ] With ready inventory below `50`, a controlled worker run replenishes toward `200` ready cards.
- [ ] With ready inventory at `50` or above, a controlled worker run does not start generation work.
- [ ] The worker never invokes more than one controlled image-generation job concurrently in a single process.
- [ ] The daily cap of `250` is persisted in SQLite and prevents further worker generation after the cap is exhausted for the same day.
- [ ] Cap accounting survives closing and reopening the database connection.
- [ ] Failed controlled generation records remain inspectable through persisted status and are excluded from public ready-card results.
- [ ] The worker re-checks ready inventory after failures/canonical upserts and does not treat failed work as ready stock.
- [ ] Tests verify threshold, target, concurrency, daily cap, durable cap state, and failure behavior using controlled external-service doubles.
- [ ] `pnpm test:worker`, `pnpm test:xai`, `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

## Out of scope

- Docker Compose service wiring; that is planned by later deployment slices.
- Admin UI, dashboards, alerting, or browser-visible worker status pages.
- Real download/share PNG behavior.
- Changing ready-card product semantics into accounts, history, collections, galleries, or independent image pools.
- Live xAI smoke execution without user-provided credentials.

## Resolved decisions

- Daily cap boundary: count worker ready-card generation-job reservations before each `generateReadyCardForHitokotoSentence(...)` call.
  - Why: this creates a simple durable hard stop for worker production, keeps the current xAI retry behavior intact, and is directly testable through controlled worker doubles.
  - Trade-off accepted: a single reserved worker job can still contain the existing one retry inside the xAI pipeline, so this is not a strict provider-request counter.

## Open questions

None blocking.
