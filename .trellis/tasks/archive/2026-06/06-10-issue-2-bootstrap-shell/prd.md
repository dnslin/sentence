# [Issue 2] Bootstrap 句画 app shell and UI prototype route

## Goal

Work from GitHub issue #2 on branch `feat/issue-2-bootstrap-shell`, using the current repository state as ground truth. Because issue #2 is already closed and the current HEAD contains `feat: add Juhua Slice 01 prototype route (#18)`, this task is limited to verifying the delivered Slice 01 behavior and implementing only minimal TDD gap fixes if a requirement fails.

## User Value

Visitors and collaborators can start the 句画 prototype locally, open a shareable `/prototype` route, and compare three structurally different UI directions before the final public experience is selected.

## Confirmed Facts

- GitHub issue #2 is closed: `[Slice 01] Bootstrap 句画 app shell and UI prototype route`.
- Current branch: `feat/issue-2-bootstrap-shell`.
- Current HEAD is `7b4a4f9 feat: add Juhua Slice 01 prototype route (#18)`, also present on `master` / `origin/master`.
- User chose the scope: verify existing implementation and fix only discovered gaps.
- `README.md` documents `pnpm dev` and `/prototype` with `quiet-gallery`, `immersive-stage`, and `paper-desk` variants.
- `app/page.tsx` provides an app shell with a `/prototype` entry point and the required product vocabulary.
- `app/prototype/page.tsx` wraps the client prototype experience in `Suspense`, preserving a default Quiet Gallery fallback.
- `app/prototype/prototype-experience.tsx` defines three local static variants and selects them via `useSearchParams().getAll("variant")`.
- Missing, invalid, or repeated `variant` values fall back to `quiet-gallery`.
- The prototype switcher is rendered only when `process.env.NODE_ENV !== "production"`.
- Project vocabulary is defined in `CONTEXT.md`: `图文卡片`, `随机短句`, and `非署名绘本风`.

## Requirements

- The project must remain startable with one documented pnpm command.
- The app shell must expose a path to the prototype route without implying final-homepage completion.
- `/prototype` must present exactly three structurally distinct prototype directions: Quiet Gallery, Immersive Stage, and Paper Desk.
- The active prototype variant must be controlled by a shareable `variant` URL search parameter.
- Query handling must be deterministic: missing, unknown, or repeated `variant` values use the documented default `quiet-gallery`.
- The prototype switcher must be visibly separate from page content in non-production builds and absent from production output.
- Copy must use the project vocabulary from `CONTEXT.md`: `句画`, `图文卡片`, `随机短句`, and `非署名绘本风`.
- Any gap fix must follow TDD vertically: one behavior test or browser-observable check, minimal implementation, then repeat.

## Acceptance Criteria

- [ ] `README.md` documents one local start command: `pnpm dev`.
- [ ] `/prototype` is available and renders a Quiet Gallery default state.
- [ ] `/prototype?variant=quiet-gallery`, `/prototype?variant=immersive-stage`, and `/prototype?variant=paper-desk` each select their matching visible direction.
- [ ] `/prototype`, `/prototype?variant=unknown`, and `/prototype?variant=quiet-gallery&variant=paper-desk` all resolve to Quiet Gallery.
- [ ] In non-production, the prototype switcher is visibly separate from the prototype content and links to shareable variant URLs.
- [ ] In production output, the prototype switcher label/control is not rendered in the DOM or accessibility tree.
- [ ] The route uses `句画`, `图文卡片`, `随机短句`, and `非署名绘本风` in user-visible copy.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass after any changes.

## Out of Scope

- Implementing the final selected Quiet Gallery public page for Slice 02.
- Fetching live Hitokoto content or generating images.
- Account, saved history, permanent collection, or production sharing/download behavior.
- Rewriting the existing Slice 01 implementation when it already satisfies the acceptance criteria.

## Open Questions

- None.
