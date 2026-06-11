# Implementation Plan: Fix PR #20 review findings

## Pre-start

- Review PR #20: https://github.com/dnslin/sentence/pull/20
- Stay on branch `issue-4-sqlite-drizzle-ready-card-api` unless creating a follow-up branch is explicitly desired.
- Before editing, read:
  - `prd.md`
  - `design.md`
  - `.trellis/spec/backend/database-guidelines.md`
  - `CLAUDE.md`
  - `package.json`
  - `lib/db/client.ts`
  - `lib/cards/ready-card-repository.ts`
  - `lib/cards/seed-ready-card.ts`
  - `tests/ready-card.spec.ts`

## Ordered checklist

### 1. P0 startup/runtime contract

- [ ] Add a Node engine/runtime requirement for `node:sqlite`.
- [ ] Prevent missing-table 500 on fresh DB before querying from `/` or `/api/ready-card`.
- [ ] Update docs/spec with the chosen setup/startup contract.
- [ ] Add or adjust tests if the behavior is observable.

### 2. Drizzle sqlite-proxy correctness

- [ ] Replace `Object.values(row)` row mapping with a SQL-column-order-safe adapter.
- [ ] Fix unsupported `db.batch()` exposure by implementing batch or hiding/narrowing it.
- [ ] Run focused typecheck/tests after adapter changes.

### 3. DB integrity and query shape

- [ ] Add constraints or query guards for `cards.accent` (and optionally `cards.status`).
- [ ] Make ready-card ordering deterministic with `created_at, id`.
- [ ] Add an index for ready lookup.
- [ ] Update migration SQL and Drizzle schema together.

### 4. Seed/test hardening

- [ ] Wrap seed upserts in a transaction.
- [ ] Make idempotence test rerun seed.
- [ ] Clean or isolate e2e DB before test server setup.
- [ ] Derive expected card from shared seed data / DTO.

### 5. Cleanup

- [ ] Delete unused `scripts/ensure-database-dir.ts` or wire it in.
- [ ] Deduplicate path resolution in `scripts/migrate.ts` by reusing `resolveDatabasePath()` or a shared side-effect-free helper.
- [ ] Decide whether migration checksum validation is in-scope; document if deferred.

### 6. Verification

- [ ] `pnpm db:setup && pnpm db:seed`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] `git status --short`

## Commit / PR update

- Commit fix changes on `issue-4-sqlite-drizzle-ready-card-api`.
- Push to origin so PR #20 updates.
- Update PR body or comment with the review-fix summary if useful.
