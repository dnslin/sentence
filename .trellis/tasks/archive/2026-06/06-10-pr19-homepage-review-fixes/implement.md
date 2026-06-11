# Implementation Plan — Fix PR #19 homepage review issues

## Phase 0 — Pre-flight

- [ ] Confirm current task path with `python ./.trellis/scripts/task.py current`.
- [ ] Confirm working tree status is clean or only contains this task's planning artifacts.
- [ ] Review `prd.md`, `design.md`, `CONTEXT.md`, ADR-0002, ADR-0003, and frontend quality guidelines.
- [ ] Do not run `task.py start` until planning artifacts are accepted.

## Phase 1 — Homepage route and Module shape

- [ ] Remove production-facing public `?state=` control from `/`.
- [ ] Remove or isolate `normalizePageState`, `pageStates`, and `StatePanel` if no non-production seam remains.
- [ ] Replace the interactive Suspense fallback with no fallback or a static non-interactive fallback.
- [ ] Split only where it increases depth:
  - [ ] stable public 图文卡片 shell/presentation
  - [ ] small client action Adapter for mock cycling and announcements
  - [ ] local mock card source seam
- [ ] Remove unused `CardMock.id` metadata.
- [ ] Remove `refreshKey` if motion parity can derive from `cardIndex`.
- [ ] Keep copy truthful: refresh/download/share are placeholder behavior until later slices.

## Phase 2 — Announcement behavior

- [ ] Replace raw message-string state with announcement-event state or equivalent unique update mechanism.
- [ ] Ensure repeated same-action clicks mutate live-region output.
- [ ] Keep `aria-live="polite"` and visible status text.
- [ ] Verify refresh, download, and share all publish appropriate feedback.

## Phase 3 — Prototype availability decision

- [ ] Keep `/prototype` direct-url-only for this PR.
- [ ] Do not add a production-facing prototype link or product CTA on `/`.
- [ ] Record direct-url-only availability as intentional in implementation notes or final report.

## Phase 4 — Trellis artifact/spec corrections

- [ ] Inspect archived Issue #2 and Issue #3 `implement.jsonl` / `check.jsonl` entries.
- [ ] Rewrite stale `.trellis/tasks/06-10-...` paths to `.trellis/tasks/archive/2026-06/06-10-...` where the target file is archived.
- [ ] Leave `_example` rows unchanged unless the manifest convention changes.
- [ ] Update reduced-motion guidance to avoid exact default animation values while preserving the emitted-property contract.
- [ ] Record Trellis archive-tooling rewrite as a follow-up if the script still leaves stale paths after future archives.

## Phase 5 — Requirement-driven verification

### Static checks

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`

### Browser-observable checks

- [ ] `/` renders ready mock homepage.
- [ ] `/?state=error` does not render false error state.
- [ ] `/?state=loading` does not render false loading state.
- [ ] `/?state=empty` does not render false empty state.
- [ ] `/?state=error&state=loading` does not render false non-ready state.
- [ ] `/?state=unknown` renders ready homepage.
- [ ] `下载 PNG` repeated click reannounces.
- [ ] `分享` repeated click reannounces.
- [ ] `再来一张` advances card and keeps feedback truthful.
- [ ] Reduced-motion mode neutralizes non-essential card motion.
- [ ] `/prototype` renders by direct URL.
- [ ] `/` does not expose a production-facing `/prototype` link.

### Artifact checks

- [ ] Archived manifest file paths point at existing archive files.
- [ ] Reduced-motion spec no longer requires exact `0.5s` / `-1deg` default values.
- [ ] Git diff contains only intentional changes for this task.

## Review gates

- [ ] After implementation, dispatch `trellis-check` with active task path first in the prompt.
- [ ] Fix confirmed issues and rerun relevant checks.
- [ ] Update task/spec artifacts if implementation reveals requirement changes.
- [ ] Do not commit or push until Phase 3 Finish requests it.

## Rollback points

- If homepage split creates pass-through Modules, revert to a smaller in-file deepening and keep only the runtime fixes.
- If direct-url-only `/prototype` proves insufficient for stakeholder review, create a separate product decision before adding a homepage link.
- If archived manifest editing reveals a tooling-wide issue, stop at current archived files and create/follow up with a separate Trellis tooling task.
- If browser checks require new test tooling not present in the repo, use manual/browser verification and document the limitation.
