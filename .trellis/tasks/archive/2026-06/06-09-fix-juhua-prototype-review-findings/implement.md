# Implementation Plan — Fix code review findings for Juhua prototype route

## Review Findings to Address

1. Font tokens: `app/layout.tsx` removed font variable providers while CSS self-references `--font-sans`.
2. Archived `implement.jsonl` points to pre-archive task paths.
3. Archived `check.jsonl` points to pre-archive task paths.
4. Homepage CTA should reuse `Button asChild`.
5. Prototype switcher links should reuse `Button asChild`.
6. `VariantView` should be exhaustive.
7. Variant IDs should have one source of truth.
8. `/prototype` should avoid request-time SSR for static local data if feasible.
9. README should restore shadcn component onboarding.
10. Type-safety spec query test scope should be narrower.
11. Quality spec prototype-control checks should be narrower.
12. Immersive Stage action guidance should not overlap.

## Concurrent Dispatch

### Agent A — Product UI/static route fixes

Files:
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `app/prototype/page.tsx`
- optional new `app/prototype/prototype-experience.tsx`
- `next.config.ts` if local dev-resource origin checks require explicit allowance

Tasks:
- Fix font variables with local system font CSS tokens.
- Use `Button asChild` for homepage CTA.
- Use `Button asChild` for switcher links.
- Remove variant ID duplication.
- Replace non-exhaustive renderer branch with `Record<VariantId, Component>` or equivalent exhaustive mapping.
- Remove overlapping action guidance.
- Make `/prototype` static if feasible by moving query selection to client-side `useSearchParams` under `Suspense`.
- Allow only the required local `127.0.0.1` Next.js development origin when browser/HMR checks need it.
- Preserve all existing accepted browser behavior.

### Agent B — Docs/spec fixes

Files:
- `README.md`
- `.trellis/spec/frontend/type-safety.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/spec/frontend/index.md` only if necessary

Tasks:
- Restore shadcn add/import onboarding in README.
- Narrow query-param test requirements to routes where query behavior is a public contract.
- Narrow prototype-only dev/prod browser check wording while keeping production DOM exclusion mandatory.

### Agent C — Archived manifest fixes

Files:
- `.trellis/tasks/archive/2026-06/06-09-juhua-slice-01-prototype-route/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-09-juhua-slice-01-prototype-route/check.jsonl`

Tasks:
- Replace stale pre-archive paths with archived repo-root-relative paths.
- Use `file`/`reason` entries, not `kind`/`path` entries.
- Include only files that exist in the repo.

## Main-Session Integration Steps

1. Start task with `task.py start` after approval.
2. Run `trellis-before-dev` before edits.
3. Dispatch Agents A, B, and C concurrently with non-overlapping file ownership.
4. After agents return, inspect git status and resolve any accidental overlaps.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
6. Run relevant `agent-browser` dev and production checks.
7. Dispatch a unified `trellis-check` agent across the full diff.
8. If checks pass, load `trellis-update-spec` only if new reusable knowledge emerged beyond these fixes.
9. Commit in atomic groups after user approval or explicit commit instruction.

## Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `python ./.trellis/scripts/task.py validate-context .trellis/tasks/archive/2026-06/06-09-juhua-slice-01-prototype-route` if available, or equivalent file-existence script.
- Dev browser:
  - `agent-browser open http://localhost:3000/prototype`
  - `agent-browser open http://localhost:3000/prototype?variant=quiet-gallery`
  - `agent-browser open http://localhost:3000/prototype?variant=immersive-stage`
  - `agent-browser open http://localhost:3000/prototype?variant=paper-desk`
  - `agent-browser open http://localhost:3000/prototype?variant=unknown`
  - `agent-browser open 'http://localhost:3000/prototype?variant=paper-desk&variant=immersive-stage'`
- Production browser:
  - `pnpm start` on an available port after build.
  - Confirm `原型切换器` is absent.

## Risks

- Moving query selection client-side can introduce hydration/fallback timing; agent-browser must verify final visible output.
- Multiple agents must not edit the same file group.
- Archived task files are already committed history; this task should add a new corrective commit rather than rewriting history.
