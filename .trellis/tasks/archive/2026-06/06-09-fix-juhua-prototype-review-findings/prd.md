# Fix code review findings for Juhua prototype route

## Goal

Fix and optimize the verified code-review findings from the 句画 Slice 01 prototype branch using concurrent sub-agents, then run a unified review and validation pass.

## User Value

The prototype branch remains small and maintainable while preserving the accepted Slice 01 behavior: a Chinese-first `/prototype` route with three URL-shareable variants, no final Slice 02 behavior, and clean Trellis records.

## Confirmed Facts

- Current branch: `feat/juhua-slice-01-prototype-route`.
- Previous Slice 01 task is archived and committed.
- Working tree was clean before this task was created; only this new Trellis task directory was untracked.
- Code-review output listed 12 non-refuted findings to fix or optimize.
- Parent task placeholder `_example` manifest rows were investigated but are not included as real findings because Trellis consumers skip seed rows without a `file` field.
- `agent-browser` is available for browser-observable checks.
- Next.js dev resources can reject cross-origin HMR requests when browser checks use `127.0.0.1` instead of the dev server's canonical host.

## Requirements

### Product code fixes

- Restore a concrete global sans/mono font token without reintroducing external Google font build fetches.
- Reuse the existing `Button` primitive with `asChild` for the homepage CTA and prototype switcher links.
- Simplify prototype variant data so variant identity has one source of truth.
- Make variant rendering exhaustive so adding a future variant cannot silently render Quiet Gallery.
- Remove overlapping action guidance in the Immersive Stage action area.
- Preserve required visible vocabulary: 句画, 图文卡片, 随机短句, 非署名绘本风.
- Preserve URL-shareable variants: `/prototype`, `/prototype?variant=quiet-gallery`, `/prototype?variant=immersive-stage`, `/prototype?variant=paper-desk`.
- Preserve invalid/missing/repeated variant fallback to Quiet Gallery.
- Optimize `/prototype` so static local data does not require request-time server rendering when feasible without breaking shareable query behavior.
- Allow the local `127.0.0.1` development origin for Next.js dev-resource/HMR browser checks without broadening production CORS behavior.

### Documentation/spec fixes

- Restore README onboarding for adding/importing shadcn UI components while keeping 句画 startup/prototype docs.
- Narrow frontend query-param testing guidance to routes where query behavior is a public contract.
- Narrow prototype-only UI testing guidance so production exclusion remains mandatory while dev checks are required when visibility itself is part of the contract.

### Trellis artifact fixes

- Update archived Slice 01 `implement.jsonl` and `check.jsonl` so file references point to archived files, not removed pre-archive task paths.
- Use the Trellis manifest `file` field for file context entries.

## Acceptance Criteria

- [ ] `app/globals.css` and `app/layout.tsx` provide stable concrete font tokens without external font fetching.
- [ ] Homepage CTA uses the shared `Button` primitive and remains keyboard-visible.
- [ ] Prototype switcher uses the shared `Button` primitive and remains visibly separate in non-production.
- [ ] Prototype variant IDs are not duplicated across tuple, record key, and object `id` fields.
- [ ] Variant rendering is exhaustive at compile time.
- [ ] Immersive Stage no longer repeats overlapping action guidance in the same area.
- [ ] `/prototype` behavior remains correct for all three variants and invalid/repeated fallback.
- [ ] `pnpm build` classifies `/prototype` as static or the implementation documents why static rendering cannot be preserved without violating URL-shareability.
- [ ] `next.config.ts` allows the required local development origin for `127.0.0.1` browser/HMR checks without adding production CORS headers or wildcard origins.
- [ ] README includes both `pnpm dev` startup docs and shadcn component onboarding.
- [ ] Frontend specs are narrower and still executable/testable.
- [ ] Archived manifest paths resolve to existing files.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, and relevant `agent-browser` checks pass.
- [ ] A unified `trellis-check` sub-agent review is completed after concurrent fixes.

## Out of Scope

- New product features beyond review remediation.
- Database/API/Hitokoto/xAI/download/share/refresh implementation.
- Pushing commits to remote.
- Reopening or changing the archived Slice 01 task status.

## Open Questions

- None. User explicitly requested concurrent sub-agent repair/optimization followed by unified review.
