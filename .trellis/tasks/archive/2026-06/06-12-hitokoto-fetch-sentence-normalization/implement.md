# Add Hitokoto fetch and sentence normalization: Implementation Plan

## Test Scenarios From Requirements

1. Happy path — controlled Hitokoto response is fetched with `encode=json`, `min_length=6`, `max_length=30`, and `c=d,e,i,k`, then normalized and stored.
2. Edge case — optional nullable Hitokoto fields such as `from_who` are accepted without weakening TypeScript types.
3. Error handling — malformed or out-of-range API responses are rejected before database writes.
4. Duplicate state transition — same Hitokoto UUID returns the existing sentence row instead of inserting another row.
5. Duplicate fallback state transition — UUID-less equivalent source identity returns the existing sentence row instead of inserting another row.
6. Regression — existing ready-card seed/API/homepage behavior still works after the additive schema change.

## Ordered TDD Checklist

- [ ] Add a focused `node --import tsx --test tests/hitokoto-pipeline.test.ts` script to `package.json`.
- [ ] RED 1: add one test for controlled successful fetch URL parameters and normalized stored result.
- [ ] GREEN 1: implement Hitokoto request constants, URL builder, response normalization, migration, schema table, and store path needed for that test.
- [ ] RED 2: add one test for duplicate UUID ingestion reusing the existing sentence row.
- [ ] GREEN 2: add UUID lookup/upsert behavior and uniqueness handling.
- [ ] RED 3: add one test for UUID-less equivalent identity duplicate handling.
- [ ] GREEN 3: add deterministic fallback source identity and reuse behavior.
- [ ] RED 4: add one test for invalid/out-of-range response rejection before writes.
- [ ] GREEN 4: harden runtime normalization errors.
- [ ] Refactor: extract any duplication, keep public interfaces small, and ensure no xAI imports exist.
- [ ] Update Trellis context manifests for implement/check agents.
- [ ] Run validation commands.

## Validation Commands

- `pnpm test:hitokoto`
- `pnpm db:setup`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

## Risky Files / Rollback Points

- `lib/db/schema.ts` and `drizzle/0003_hitokoto_sentence_metadata.sql`: schema/migration must remain additive and compatible with existing seed data.
- `package.json`: test script addition must not disrupt existing commands.
- `tests/`: Playwright defaults to all files under `tests`; the Node test file should be excluded from Playwright discovery or named/placed so `pnpm test:e2e` still only runs Playwright tests.

## Pre-Start Review Gate

- PRD has no blocking open questions.
- Design keeps xAI and card creation out of scope.
- Test plan maps each requirement to at least one behavior scenario.
- The implementation can proceed under strict TypeScript without `any` or unsafe casts outside runtime guards.
