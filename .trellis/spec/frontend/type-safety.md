# Type Safety

> Type safety patterns in this project.

---

## Overview

The project uses strict TypeScript with Next.js App Router. Prefer narrow local types at route/component boundaries and normalize untrusted framework inputs before rendering.

---

## Route Search Params

### Contract: App Router page `searchParams`

**Scope / Trigger**: Any `app/**/page.tsx` Server Component that reads URL query parameters.

**Signature**:

```typescript
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
}
```

**Contracts**:

- `searchParams` is a Promise in Next.js 16 App Router pages.
- Individual fields may be `string`, `string[]`, or `undefined`.
- Route code must normalize query values once before selecting behavior.
- Public/browser-observable query behavior must document its default and fallback values near the route boundary.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Missing query value | Use the route's documented default. |
| Unknown query value | Use the documented fallback, not an error page. |
| Repeated query value producing `string[]` | Treat as invalid unless the route explicitly supports arrays. |

**Good/Base/Bad Cases**:

- Good: `?variant=quiet-gallery` selects a known public variant.
- Base: no `variant` falls back to the documented default variant.
- Bad: `?variant=a&variant=b` must not silently select one arbitrary value unless arrays are part of the route contract.

**Tests Required**:

For routes where query behavior is a public/browser-observable contract, run browser or route-level checks for:

- Valid query values.
- Missing query fallback.
- Repeated query fallback when the route accepts only one value.

For routes where query values only support internal implementation details, tests may be covered through the owning feature's behavior, but the route boundary must still normalize `string | string[] | undefined` before use.

**Wrong vs Correct**:

#### Wrong

```typescript
export default function Page({ searchParams }: { searchParams: { variant?: string } }) {
  return <div>{searchParams.variant}</div>
}
```

#### Correct

```typescript
const variants = ["quiet-gallery", "immersive-stage", "paper-desk"] as const
type VariantId = (typeof variants)[number]

type SearchParams = Promise<{ variant?: string | string[] }>

function normalizeVariant(value: string | string[] | undefined): VariantId {
  if (typeof value !== "string") return "quiet-gallery"
  return variants.includes(value as VariantId) ? (value as VariantId) : "quiet-gallery"
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const variant = normalizeVariant(params.variant)
  return <div>{variant}</div>
}
```

---

## Static Pages With Browser Query Selection

### Contract: keep static routes static when the server does not need request-bound query data

**Scope / Trigger**: A route uses query parameters only to select browser-visible UI state, and all selectable data is local/static.

**Signature**:

```tsx
// app/example/page.tsx
import { Suspense } from "react"

import { ExampleExperience } from "./example-experience"

export default function Page() {
  return (
    <Suspense fallback={<DefaultExperience />}>
      <ExampleExperience />
    </Suspense>
  )
}
```

```tsx
// app/example/example-experience.tsx
"use client"

import { useSearchParams } from "next/navigation"

export function ExampleExperience() {
  const searchParams = useSearchParams()
  const values = searchParams.getAll("variant")
  const selected = normalizeVariant(values)

  return <VariantView selected={selected} />
}
```

**Contracts**:

- Do not read Server Component `searchParams` just to select among local/static UI variants.
- Use a client component with `useSearchParams()` when the query affects only browser-visible state.
- Wrap the client component in `Suspense` so the route can remain statically prerendered.
- Normalize repeated values with `getAll()` when repeated query values must fall back.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Server needs query data for data fetching, auth, redirects, metadata, or status codes | Use server `searchParams`; dynamic rendering is expected. |
| Query only selects local/static UI | Prefer client `useSearchParams` under `Suspense`; build should keep the route static. |
| Repeated query values | Use `getAll()` and apply the documented fallback. |
| Missing JavaScript before hydration | Suspense fallback must render a safe documented default. |

**Good/Base/Bad Cases**:

- Good: `/prototype?variant=paper-desk` selects a static variant in the client while `next build` reports `○ /prototype`.
- Base: `/prototype` renders the fallback/default variant before hydration and the same default after hydration.
- Bad: awaiting server `searchParams` for static local variants makes the route `ƒ` dynamic without server-side need.

**Tests Required**:

- `pnpm build` or equivalent must confirm the route remains static when static rendering is expected.
- Browser checks must cover valid, missing, invalid, and repeated query values when query selection is public behavior.
- If the route intentionally stays dynamic, document the server-side need in the task design or code comments.

**Wrong vs Correct**:

#### Wrong

```tsx
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  return <VariantView selected={normalizeVariant(params.variant)} />
}
```

#### Correct

```tsx
export default function Page() {
  return (
    <Suspense fallback={<DefaultVariant />}>
      <VariantExperience />
    </Suspense>
  )
}
```

```tsx
"use client"

function VariantExperience() {
  const selected = normalizeVariant(useSearchParams().getAll("variant"))
  return <VariantView selected={selected} />
}
```

---

## Type Organization

- Keep page-local route query types near the page when they are not shared.
- Promote a type to `lib/` only after multiple routes/components need the same contract.

---

## Validation

- Validate framework boundary values at the route entry point.
- Rendering code should receive normalized values, not raw `string | string[] | undefined` values.
- Browser or route-level query checks are required when the query controls documented public route behavior.

---

## Forbidden Patterns

- Do not treat `searchParams` as a synchronous object in Next.js 16 pages.
- Do not cast query values directly in multiple components; normalize once at the route boundary.
- Do not use `any` for route query values.
