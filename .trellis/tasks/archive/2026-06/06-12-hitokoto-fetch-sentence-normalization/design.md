# Add Hitokoto fetch and sentence normalization: Design

## First-Principles Analysis

### Challenge Assumptions

- Assumption: fetching Hitokoto must immediately create a ready 图文卡片. This is wrong for issue #6 because xAI prompt/image generation and WebP storage are later slices.
- Assumption: Hitokoto metadata can be discarded after saving sentence text. This is unverified and risky because duplicate detection, future smoke traces, and source transparency need durable source identity.
- Assumption: duplicate prevention can use only the `sentences.id` primary key. This is incomplete because Hitokoto duplicate identity is expressed as `uuid`, while equivalent fallback identity is a normalized source fact.
- Assumption: tests must use the real Hitokoto service. This is wrong for deterministic TDD because acceptance requires controlled API responses.
- Assumption: adding a heavyweight test framework is necessary. This is unverified; Node 22 already includes `node:test`, and the project already has `tsx` for TypeScript execution.

### Decompose to Bedrock Truths

- A generation pipeline needs an input sentence record before any image can be generated.
- The external network returns untyped JSON; TypeScript type safety only exists after runtime normalization rejects or narrows unknown values.
- Duplicate rows are prevented by deterministic identities and database constraints, not by caller discipline.
- SQLite can enforce uniqueness through primary keys and unique indexes; nullable unique columns allow repeated `NULL`, so fallback identity needs its own non-null value.
- The existing public ready-card path reads `sentences.text`; any schema change must preserve existing seed and card queries.
- Controlled tests need a public exported module boundary that accepts an injected `fetch` implementation; they do not need xAI credentials.

### Rebuild From Ground Up

1. Build the Hitokoto URL from constants: endpoint `https://v1.hitokoto.cn/`, `encode=json`, `min_length=6`, `max_length=30`, and repeated `c=d&e&i&k` parameters.
2. Fetch through an injectable `fetch` function so tests can supply deterministic responses and production can use global `fetch`.
3. Normalize unknown JSON into a `NormalizedHitokotoSentence` with strict string/number/null handling and a 6–30 character text invariant.
4. Compute two identities:
   - `hitokotoUuid` when the response contains a usable UUID.
   - `sourceIdentity`, always non-null, using `hitokoto:uuid:<uuid>` when possible or a deterministic normalized fallback from text/type/source/from_who when UUID is absent.
5. Persist one generic `sentences` row and one Hitokoto metadata row in the same transaction.
6. Enforce duplicate safety with unique indexes on `hitokoto_uuid` and `source_identity` in the metadata table.
7. Return an ingestion result that tells callers whether the sentence row was created or reused, without creating a card or calling xAI.
8. Add Node `node:test` + `tsx` behavior tests for request construction, normalization, UUID duplicates, and fallback identity duplicates.

### Contrast With Convention

A conventional shortcut would put ad-hoc `fetch("https://v1.hitokoto.cn/?...")` code inside a future worker and save only text. That would make duplicates and malformed JSON a runtime surprise. The fundamental difference here is that the external boundary is narrowed once, identities are durable database facts, and downstream generation receives a stable sentence row.

### Conclusion

The smallest complete design is a `lib/generation/hitokoto-*` module boundary plus an additive metadata table. This preserves the current ready-card UI path, makes the first generation slice executable without xAI, and lets tests control the external API exactly.

## Architecture and Boundaries

### Proposed Files

- `lib/generation/hitokoto-client.ts` — request constants, URL builder, injectable fetch wrapper, and response normalization.
- `lib/generation/hitokoto-sentence-repository.ts` — Drizzle persistence for normalized Hitokoto sentences and duplicate-safe ingestion.
- `lib/generation/hitokoto-pipeline.ts` — single public pipeline function that fetches and stores one Hitokoto sentence without xAI.
- `lib/db/schema.ts` — add Hitokoto sentence metadata table and inferred row types.
- `drizzle/0003_hitokoto_sentence_metadata.sql` — additive migration.
- `tests/hitokoto-pipeline.test.ts` — Node test runner coverage for controlled API responses and duplicate handling.
- `package.json` — add a focused test script for the Hitokoto pipeline.

### Data Model

Keep `sentences` as the generic sentence table used by cards. Add a source-specific metadata table:

```text
hitokoto_sentence_metadata(
  sentence_id text primary key references sentences(id),
  hitokoto_uuid text unique nullable,
  source_identity text not null unique,
  hitokoto_id integer nullable,
  type text nullable,
  from_text text nullable,
  from_who text nullable,
  creator text nullable,
  creator_uid integer nullable,
  reviewer integer nullable,
  commit_from text nullable,
  hitokoto_created_at text nullable,
  length integer nullable,
  fetched_at integer not null
)
```

Why separate table instead of widening `sentences` with many nullable columns:

- Existing mock and ready-card seed rows remain valid without synthetic Hitokoto metadata.
- Future sources can add their own metadata without bloating the generic sentence row.
- Duplicate constraints belong to Hitokoto-specific identity facts.

### Public Type Contracts

```ts
type HitokotoCategory = "d" | "e" | "i" | "k"

type NormalizedHitokotoSentence = {
  text: string
  source: "hitokoto"
  hitokotoUuid: string | null
  sourceIdentity: string
  metadata: {
    hitokotoId: number | null
    type: string | null
    from: string | null
    fromWho: string | null
    creator: string | null
    creatorUid: number | null
    reviewer: number | null
    commitFrom: string | null
    createdAt: string | null
    length: number | null
  }
}

type StoredHitokotoSentence = {
  sentenceId: string
  sentenceText: string
  sourceIdentity: string
  hitokotoUuid: string | null
  inserted: boolean
}
```

### Data Flow

```text
fetchHitokotoSentence(fetchFn)
  → normalizeHitokotoResponse(unknown)
  → storeHitokotoSentence(client, normalized)
  → { sentenceId, inserted }
```

The pipeline stops there. No card row is created and no xAI module exists in this slice.

## Compatibility and Migration Notes

- Migration is additive: it creates a new metadata table and indexes only.
- Existing `sentences`, `cards`, and `ready_card_views` rows are unchanged.
- Existing seed data remains `source="mock"` and does not need Hitokoto metadata.
- Existing ready-card repository still joins `cards → sentences` and ignores the new table.

## Testing Strategy

Use vertical TDD with one behavior test and one implementation slice at a time:

1. Request construction and successful normalization through an injected controlled `fetch` response.
2. Store a normalized response and assert the returned ingestion result and persisted row via exported repository behavior.
3. Re-ingest the same UUID and assert the same sentence ID is reused and row count stays one.
4. Re-ingest UUID-less equivalent identity and assert the same sentence ID is reused and row count stays one.
5. Run existing ready-card e2e after implementation to protect current public behavior.

## Operational and Rollback Considerations

- If Hitokoto is unreachable in production, the pipeline function should throw a clear fetch/normalization error; retry policy belongs to the later worker slice unless a transient retry is needed inside a caller.
- If this slice must be rolled back, remove the new generation modules, test script, and additive migration/table before any production metadata depends on it.
- No secrets are introduced.
