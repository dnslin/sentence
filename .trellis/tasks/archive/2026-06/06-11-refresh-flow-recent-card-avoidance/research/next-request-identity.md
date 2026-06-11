# Next.js 16 request identity research

## Question

How should this task read/set anonymous cookies and request headers in a Next.js 16 App Router app while keeping TypeScript strictness?

## Sources checked

- Context7 `/vercel/next.js/v16.2.2`, query: App Router cookies/headers in Server Components and Route Handlers.
- Context7 `/vercel/next.js/v16.2.2`, query: proxy/middleware cookie setting and request header forwarding.

## Findings

- `cookies()` and `headers()` from `next/headers` are asynchronous in Next.js 16 and must be awaited in Server Components and Route Handlers.
- Route Handlers can set cookies on `NextResponse` with `response.cookies.set({ name, value, path, httpOnly, sameSite, secure })`.
- App Router Server Components can read request cookies/headers but should not be used as the cookie-setting boundary for this feature.
- Next.js 16 documents the request-interception file convention as `proxy.ts` with `export function proxy(request: NextRequest)`.
- `proxy.ts` can read incoming cookies via `request.cookies`, set outgoing cookies on `NextResponse.next()`, and pass modified request headers downstream via `NextResponse.next({ request: { headers } })`.

## Planning consequence

Use a small `proxy.ts` boundary for `/` and `/api/ready-card` so first page render and refresh API requests share an anonymous cookie. The proxy should set the browser cookie and also add that cookie to the forwarded request header when it had to mint a new value, letting `app/page.tsx` record the initially served card in the same recent-card window as later refreshes.
