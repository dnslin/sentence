# Design: Fix PR #20 code review findings

## First-principles framing

### Bedrock truths

- A public route must not fail with an uncontrolled SQLite missing-table exception for a predictable fresh-checkout state.
- A wrapper/proxy must either faithfully implement the wrapped API surface or hide unsupported methods.
- Database schema should reject or avoid data that the public DTO mapper cannot represent.
- Tests named after a behavior must execute the behavior, not a weaker proxy.
- Project instructions must match executable commands or future agents will skip required checks.

### Target shape

Keep the issue #4 architecture intact:

```text
SQLite -> Drizzle repository -> PublicReadyCard DTO -> API and homepage
```

Make focused changes that harden this path rather than introducing future product features.

## Recommended fix design

### Fresh DB / migration state

Options:

1. Make `dev` run `pnpm db:setup && next dev` and document production/deploy setup separately.
2. Add a schema-existence check before repository queries and return a controlled setup error/404 instead of missing-table exceptions.
3. Auto-migrate on first request.

Recommendation: prefer option 1 plus a defensive schema check if cheap. Avoid heavy auto-migration on every public request unless there is a clear operational contract.

### Node runtime requirement

Add a concrete Node version contract in `package.json` (for example `engines.node`) and update docs/spec to match the actual `node:sqlite` requirement.

### Drizzle sqlite-proxy adapter

The current adapter uses `Object.values(row)`. Replace with one of:

- Use `node:sqlite` array-return mode (`statement.setReturnArrays(true)`) so rows are returned in SQL column order.
- Or build row arrays by parsing selected field order, but this is more fragile.

Also address `db.batch()`:

- Implement the sqlite-proxy batch callback, or
- Export a narrowed database client type that does not expose unsupported `batch`, or
- Switch to a native Drizzle SQLite driver if available in this dependency set.

### Data constraints

Add DB-level constraints for current public enums where feasible:

- `cards.status` should at least protect currently known values if this PR only serves `ready`.
- `cards.accent` should be constrained to `dawn`, `rain`, `moon` or the query should exclude invalid accents before mapping.

If changing migration SQL, remember this branch has no production data yet; updating the initial migration is acceptable before merge.

### Deterministic query and index

Update Drizzle schema/migration and repository query:

- `ORDER BY cards.created_at ASC, cards.id ASC`.
- Add an index such as `(status, created_at, id)`.

### Seed and tests

- Wrap sentence/card upserts in one transaction.
- Make Playwright setup remove the test DB and sidecar files before running `db:setup`, or use a unique DB path.
- Make the seed-idempotence test actually rerun seed.
- Derive expected test data from `seedReadyCard` or a shared public seed DTO.

### Docs/spec

Update:

- `CLAUDE.md` Commands/testing section.
- `.trellis/spec/backend/database-guidelines.md` if any contract changes.

## Validation

Run:

```bash
pnpm db:setup && pnpm db:seed
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

If changing startup scripts, also run a fresh DB simulation by deleting ignored local DB files and verifying the documented start path.
