# Fix PR #20 code review findings

## Goal

Fix the verified `/code-review PR #20` findings before merging PR #20 (`Add SQLite/Drizzle ready-card API path`).

## User Value

The issue #4 ready-card API path should be safe to merge without known startup, database-contract, test-coverage, or documentation regressions.

## Source Context

- PR: https://github.com/dnslin/sentence/pull/20
- Branch: `issue-4-sqlite-drizzle-ready-card-api`
- Base: `master`
- Review command already run: `/code-review PR #20`
- Review mode: max effort, 9 finder angles, one-vote verification, sweep.
- Prior issue #4 implementation has already been committed and pushed.
- This task should be completed on top of the PR branch before updating PR #20.

## Requirements

### P0 / P1 correctness fixes

- Prevent fresh checkout / clean deploy runtime failures when the SQLite database has not been migrated or seeded before `/` or `/api/ready-card` are requested.
- Declare or enforce the Node runtime requirement for `node:sqlite`.
- Fix the Drizzle `sqlite-proxy` adapter so row mapping does not rely on `Object.values(row)` object enumeration order.
- Prevent or correctly implement unsupported `client.db.batch()` behavior from the sqlite-proxy wrapper.
- Make the seed-idempotence test actually rerun the seed operation or command.
- Prevent invalid `cards.accent` values from crashing the public ready-card API.

### P2 stability / performance / consistency fixes

- Make ready-card ordering deterministic when multiple rows share the same `created_at`.
- Add a supporting index for ready-card lookup by `status` and `created_at` / tie-breaker.
- Ensure Playwright e2e runs use a clean or unique test database.
- Wrap sentence/card seed upserts in a transaction.
- Update `CLAUDE.md` so testing instructions mention the newly added `pnpm test:e2e` command.

### P3 cleanup fixes

- Remove or wire the unused `scripts/ensure-database-dir.ts` script.
- Deduplicate database path resolution between `scripts/migrate.ts` and `lib/db/client.ts`.
- Decide whether to add migration checksum validation now or explicitly defer it with a documented rationale.
- Derive Playwright expected seed card data from the exported seed data or another single source of truth.

## Acceptance Criteria

- [ ] PR #20 branch has no known P0/P1 review findings remaining.
- [ ] Fresh local startup behavior is deterministic and documented: either `pnpm dev`/`pnpm start` cannot hit missing-table crashes, or the app returns a clear controlled setup error before querying missing tables.
- [ ] `package.json` or project docs declare the Node version required for `node:sqlite`.
- [ ] Drizzle adapter row mapping is positional by SQL selected-column order, not object enumeration order.
- [ ] `client.db.batch()` cannot crash accidentally due to missing proxy batch callback.
- [ ] Invalid accent data is rejected at the database/query boundary or handled as unavailable data, not as an unhandled public 500.
- [ ] Ready-card lookup is deterministic and indexed.
- [ ] Seed operation is transactional and idempotence is covered by a behavior test that reruns seed.
- [ ] E2E tests start from a clean/isolated database.
- [ ] `CLAUDE.md` and `.trellis/spec/backend/database-guidelines.md` remain accurate after the fixes.
- [ ] `pnpm db:setup && pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.
- [ ] PR #20 is updated with the fix commit(s).

## Out of Scope

- New product capabilities beyond issue #4.
- Real Hitokoto fetching, image generation, WebP storage, refresh avoidance, download/share, or worker pool behavior.
- Reworking the entire migration system unless needed for a high-priority finding.

## Open Questions for Next Session

- Should migration checksum validation be fixed in this PR or deferred to a separate migration-hardening task? Recommendation: defer unless quick and low-risk; prioritize P0/P1/P2 fixes first.
- Should fresh startup auto-run migrations, fail with a controlled setup message, or make `dev/start` run setup? Recommendation: use the simplest deterministic behavior that prevents missing-table crashes and matches deployment expectations.
