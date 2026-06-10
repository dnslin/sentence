# Design — Fix code review findings for Juhua prototype route

## First-Principles Reasoning

### 1. Challenge Assumptions

- Assumption: every review item must be fixed by adding more code. Unverified; some should be fixed by deleting duplication or narrowing docs.
- Assumption: restoring Google fonts is the only way to fix font tokens. Wrong under this environment because previous build failed on external font fetch; concrete local system font tokens satisfy the UI contract without network dependency.
- Assumption: server `searchParams` is required for shareable URLs. It is one implementation, not a bedrock requirement; the fundamental requirement is that the browser URL controls the visible variant.
- Assumption: archived manifests can keep pre-archive paths. Wrong if future replay tools read those paths after the source directory is moved.
- Assumption: concurrent agents can edit the same file safely. Risky; concurrency must be partitioned by file/domain to avoid collisions.

### 2. Decompose to Bedrock Truths

- Browser-visible behavior is the public interface for this slice.
- Static prototype data does not need request-time server computation.
- A URL query is available in the browser without a server render.
- Next.js can prerender a static Server Component page if it does not await request-bound `searchParams`.
- Shared UI primitives centralize focus and interaction styles; bypassing them duplicates accessibility contracts.
- Trellis JSONL file context entries are repo-root-relative `file` paths.
- Archived task files live under `.trellis/tasks/archive/<yyyy-mm>/<task>/` after archiving.

### 3. Rebuild From Ground Up

1. Keep `app/prototype/page.tsx` as a static server wrapper.
2. Move URL query selection into a small client component that reads `useSearchParams`, wrapped by `Suspense`, preserving shareable URLs while allowing the route shell to prerender.
3. Define variants once as a record without an internal duplicated `id`; derive `VariantId` from the record keys.
4. Define renderer mapping as `Record<VariantId, Component>` so a new variant must supply a renderer at compile time.
5. Replace hand-written CTA/switcher links with `Button asChild` around `Link`.
6. Replace self-referential font tokens with local system font variables in CSS; do not reintroduce external build-time font fetches.
7. Narrow spec language to public-contract cases so future work remains testable without excessive ceremony.
8. Rewrite archived manifests with `file` entries pointing at archived files.

### 4. Contrast With Convention

A conventional quick fix would restore `next/font/google`, keep server `searchParams`, and patch individual classes. That would pass local UI checks but reintroduce offline build fragility, keep dynamic SSR for static prototype data, and preserve duplicated variant contracts. The deeper fix is to move each concern to its actual boundary: CSS owns font tokens, client URL state owns browser query selection, shared Button owns focus styling, and manifest paths point to actual archived files.

### 5. Conclusion

Use file-partitioned concurrent agents: one for product UI/static route fixes, one for spec/README wording, one for Trellis archived manifests. Then run a single unified check agent across the resulting diff.

## Architecture and Boundaries

### Product UI boundary

- `app/layout.tsx`: keep metadata/lang and simple `font-sans` class.
- `app/globals.css`: provide concrete local font variables.
- `app/page.tsx`: import `Button`; render CTA through `Button asChild`.
- `app/prototype/page.tsx`: static server route wrapper.
- `app/prototype/prototype-experience.tsx` or equivalent: client-side URL selection and variant rendering.
- `next.config.ts`: development-origin allowance for local browser automation/HMR only; do not add production CORS headers or wildcard origins.

### Specs/docs boundary

- `README.md`: retain 句画 docs and re-add shadcn add/import section.
- `.trellis/spec/frontend/type-safety.md`: keep Next 16 async server `searchParams` guidance, but scope test matrix to public query contracts.
- `.trellis/spec/frontend/quality-guidelines.md`: keep production DOM exclusion mandatory, narrow dev check burden.

### Trellis artifact boundary

- `.trellis/tasks/archive/2026-06/06-09-juhua-slice-01-prototype-route/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-09-juhua-slice-01-prototype-route/check.jsonl`

Use `file` fields and archived repo-root-relative paths. Keep external URL/library references out of these file manifests unless a supported manifest schema exists for them.

## Concurrency Plan

- Agent A — Product route/UI: `app/globals.css`, `app/page.tsx`, `app/prototype/**`, maybe `app/layout.tsx` only if needed.
- Agent B — Docs/specs: `README.md`, `.trellis/spec/frontend/type-safety.md`, `.trellis/spec/frontend/quality-guidelines.md`, `.trellis/spec/frontend/index.md` if needed.
- Agent C — Trellis manifests: archived Slice 01 `implement.jsonl` and `check.jsonl` only.
- Main session — resolve any collisions, run/check orchestration, dispatch final `trellis-check`.

## Validation Strategy

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Confirm build route table for `/prototype`.
- Confirm `next.config.ts` only permits the required local `127.0.0.1` development origin and does not add production CORS behavior.
- `agent-browser` checks for default, three valid variants, invalid variant, repeated variant, dev switcher visibility, and production switcher absence.
- File existence check for archived manifest `file` entries.

## Rollback Considerations

- Product UI fixes are limited to the prototype branch and can be reverted independently.
- Spec narrowing is docs-only and can be adjusted if future team preference is stricter.
- Archived manifest path fixes should not change task status or journal commits.
