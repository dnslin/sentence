# Fix PR #19 homepage review issues

## Goal

Resolve the verified PR #19 review findings that affect the public Quiet Gallery homepage and closely related PR hygiene/spec artifacts, while preserving the current product scope: 句画 remains a lightweight public experience that shows a mock 图文卡片 until later slices connect the real pregenerated pool, download, and share capabilities.

## Source Inputs

- PR #19 code review handoff dated 2026-06-10.
- Architecture review report generated for this session.
- `CONTEXT.md` domain vocabulary: 图文卡片, 一言, 图文绑定, 刷新生成, 随机短句, 非署名绘本风.
- ADR-0002: hybrid pregenerated card pool.
- ADR-0003: SQLite metadata and local WebP storage.
- Frontend quality guidelines for route behavior, reduced motion, semantic HTML, and production-only output.

## Requirements

### R1 — Public route must not expose mock state control

- The production `/` route must not let external users force `loading`, `empty`, or `error` UI through `?state=`.
- Any remaining mock-state behavior must be unavailable in production-facing output, or moved to a clearly non-production-only seam.
- Invalid or repeated public query parameters must render the normal ready homepage, not a false failure state.

### R2 — First paint must not show a misleading interactive fallback

- The `/` route must not initially render a full ready 图文卡片 with temporary buttons as a Suspense fallback for state selection.
- If a fallback remains, it must be static and non-interactive.
- The fallback must not claim real refresh/download/share behavior before those slices exist.

### R3 — Action feedback must reannounce repeated actions

- Repeated clicks on the same download/share placeholder action must cause an observable live-region text update.
- The live region must remain polite and visible enough for browser-observable verification.
- Refresh feedback must still update when the user requests another mock 图文卡片.

### R4 — Homepage state and mock card data must be simpler and less misleading

- Remove unused mock card metadata that is not part of the current product contract.
- Avoid duplicate state when visual motion can be derived from the selected card state.
- Keep non-ready mock state concepts separate from the ready state if any mock-state seam remains.

### R5 — Homepage Module shape must improve locality without implementing future slices

- The public homepage should move toward a deeper Module shape: stable 图文卡片 presentation and route policy should not be entangled with client-only action state.
- Do not implement real Hitokoto, generation, SQLite, WebP storage, download, or Web Share behavior in this task.
- Preserve current public copy that truthfully says mock data is used and future abilities are not connected yet.

### R6 — Prototype route availability must be intentionally handled

- `/prototype` must remain available by direct URL.
- `/` must not add a production-facing link to `/prototype`; prototype discovery remains direct-url-only for this PR.
- The implementation notes or final report must record that this is intentional, not an accidental removal.

### R7 — PR hygiene findings must be triaged without unsafe history surgery

- Identify whether unrelated Issue #2 archive artifacts remain in the PR diff.
- Do not rebase, force-push, or rewrite history unless a separate explicit approval is obtained.
- If strict PR hygiene requires branch surgery, record it as a follow-up instead of performing it inside this task.

### R8 — Archived manifest paths must not point at moved task locations

- Archived Trellis JSONL manifest entries for Issue #2 and Issue #3 must point to their archive paths if they are kept in the PR.
- The `_example` JSONL rows are not a bug and must not be treated as the cause.

### R9 — Reduced-motion guidance must avoid overfitting exact homepage values

- Frontend quality guidance must assert behavior generically: reduced motion neutralizes non-essential motion and checks emitted computed properties.
- The guidance must not make harmless homepage tuning appear invalid by requiring exact default duration or rotation values.

## Acceptance Criteria

- [ ] Visiting `/` ignores public `?state=loading`, `?state=empty`, `?state=error`, invalid, and repeated `state` parameters unless an explicitly non-production seam is used.
- [ ] The `/` first paint/fallback is either unnecessary or static and non-interactive.
- [ ] Repeated clicks on `下载 PNG` produce repeated live-region mutations.
- [ ] Repeated clicks on `分享` produce repeated live-region mutations.
- [ ] `再来一张` still advances through mock 图文卡片 and keeps reduced-motion behavior valid.
- [ ] Unused mock `id` metadata is removed unless a real contract needs it in this task.
- [ ] Duplicate animation state is removed or justified by a documented state transition.
- [ ] `/prototype` remains available by direct URL and `/` does not add a production-facing prototype link.
- [ ] Archived Issue #2 and Issue #3 JSONL manifests use archive paths for archived PRD/design/implement entries, if those artifacts remain part of the branch.
- [ ] Reduced-motion guidance no longer hard-codes exact default homepage animation values as mandatory.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- [ ] Browser-observable checks cover `/`, relevant query variants, action buttons, reduced-motion mode, and `/prototype` availability.

## Out of Scope

- Real Hitokoto integration.
- Real image generation.
- Real pregenerated card pool implementation.
- SQLite/Drizzle schema or local WebP storage implementation.
- Real PNG download or Web Share integration.
- Git history rewrite, force-push, or PR branch split without separate approval.
- Reopening accepted ADRs.

## Resolved Decisions

- `/prototype` remains direct-url-only for this PR; `/` will not add a production-facing prototype link.
- This task manually fixes the archived manifest paths currently in the branch; Trellis archive tooling changes are a follow-up, not part of this implementation.
