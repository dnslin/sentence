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

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Missing query value | Use the route's documented default. |
| Unknown query value | Use the documented fallback, not an error page. |
| Repeated query value producing `string[]` | Treat as invalid unless the route explicitly supports arrays. |

**Good/Base/Bad Cases**:

- Good: `?variant=quiet-gallery` selects a known variant.
- Base: no `variant` falls back to the default variant.
- Bad: `?variant=a&variant=b` must not silently select one arbitrary value unless arrays are part of the route contract.

**Tests Required**:

- Browser or route-level check for valid query values.
- Browser or route-level check for missing query fallback.
- Browser or route-level check for repeated query fallback when the route accepts only one value.

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

## Type Organization

- Keep page-local route query types near the page when they are not shared.
- Promote a type to `lib/` only after multiple routes/components need the same contract.

---

## Validation

- Validate framework boundary values at the route entry point.
- Rendering code should receive normalized values, not raw `string | string[] | undefined` values.

---

## Forbidden Patterns

- Do not treat `searchParams` as a synchronous object in Next.js 16 pages.
- Do not cast query values directly in multiple components; normalize once at the route boundary.
- Do not use `any` for route query values.
