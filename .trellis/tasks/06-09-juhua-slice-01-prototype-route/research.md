# Research Notes — Slice 01 Prototype Route

- GitHub issue #2 requires a base Next.js/Tailwind/shadcn app shell and throwaway prototype route with Quiet Gallery, Immersive Stage, and Paper Desk variants.
- GitHub issue #2 is unblocked and belongs to parent issue #1.
- `CONTEXT.md` defines required vocabulary: 句画, 图文卡片, 随机短句, 非署名绘本风.
- Current app is a Next.js template with placeholder homepage and generic README.
- Context7 `/vercel/next.js/v16.2.2` documentation says App Router page `searchParams` is a Promise and should be awaited in Server Components.
- `agent-browser --help` confirms the CLI is installed and supports Playwright-style browser operations for route checks.
- Existing project has no Vitest or Playwright config; user clarified `agent-browser` is sufficient for automated TDD checks in this project.
