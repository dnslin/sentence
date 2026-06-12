export const hitokotoEndpoint = "https://v1.hitokoto.cn/"
export const hitokotoMinLength = 6
export const hitokotoMaxLength = 30
export const hitokotoCategories = ["d", "e", "i", "k"] as const

export type HitokotoCategory = (typeof hitokotoCategories)[number]

export type NormalizedHitokotoSentence = {
  text: string
  source: "hitokoto"
  hitokotoUuid: string | null
  sourceIdentity: string
  metadata: {
    hitokotoId: number | null
    type: string | null
    from: string | null
    fromWho: string | null
    creator: string | null
    creatorUid: number | null
    reviewer: number | null
    commitFrom: string | null
    createdAt: string | null
    length: number | null
  }
}

type HitokotoFetchResponse = {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export type HitokotoFetch = (url: string) => Promise<HitokotoFetchResponse>

export class HitokotoFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HitokotoFetchError"
  }
}

export class HitokotoNormalizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HitokotoNormalizationError"
  }
}

function asRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HitokotoNormalizationError("Hitokoto response must be an object")
  }

  return value as Record<string, unknown>
}

function normalizeRequiredString(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HitokotoNormalizationError(`Hitokoto ${key} must be a string`)
  }

  return value.trim()
}

function normalizeNullableString(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key]
  if (value === null || value === undefined) return null
  if (typeof value !== "string") {
    throw new HitokotoNormalizationError(`Hitokoto ${key} must be string or null`)
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNullableInteger(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key]
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HitokotoNormalizationError(`Hitokoto ${key} must be integer or null`)
  }

  return value
}

function normalizeTextForIdentity(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeHitokotoUuid(value: string | null) {
  if (!value) return null

  const normalized = value.toLowerCase()
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  return uuidPattern.test(normalized) ? normalized : null
}

function buildFallbackSourceIdentity(input: {
  text: string
  type: string | null
  from: string | null
  fromWho: string | null
}) {
  return `hitokoto:fallback:${JSON.stringify([
    normalizeTextForIdentity(input.text),
    input.type ?? "",
    input.from ?? "",
    input.fromWho ?? "",
  ])}`
}

export function buildHitokotoUrl() {
  const url = new URL(hitokotoEndpoint)
  url.searchParams.set("encode", "json")
  url.searchParams.set("min_length", String(hitokotoMinLength))
  url.searchParams.set("max_length", String(hitokotoMaxLength))

  for (const category of hitokotoCategories) {
    url.searchParams.append("c", category)
  }

  return url.toString()
}

export function normalizeHitokotoResponse(
  response: unknown
): NormalizedHitokotoSentence {
  const record = asRecord(response)
  const text = normalizeRequiredString(record, "hitokoto")
  const textLength = Array.from(text).length

  if (textLength < hitokotoMinLength || textLength > hitokotoMaxLength) {
    throw new HitokotoNormalizationError(
      `Hitokoto text length must be ${hitokotoMinLength}-${hitokotoMaxLength}`
    )
  }

  const hitokotoUuid = normalizeHitokotoUuid(
    normalizeNullableString(record, "uuid")
  )
  const type = normalizeNullableString(record, "type")
  const from = normalizeNullableString(record, "from")
  const fromWho = normalizeNullableString(record, "from_who")
  const sourceIdentity = hitokotoUuid
    ? `hitokoto:uuid:${hitokotoUuid}`
    : buildFallbackSourceIdentity({ text, type, from, fromWho })

  return {
    text,
    source: "hitokoto",
    hitokotoUuid,
    sourceIdentity,
    metadata: {
      hitokotoId: normalizeNullableInteger(record, "id"),
      type,
      from,
      fromWho,
      creator: normalizeNullableString(record, "creator"),
      creatorUid: normalizeNullableInteger(record, "creator_uid"),
      reviewer: normalizeNullableInteger(record, "reviewer"),
      commitFrom: normalizeNullableString(record, "commit_from"),
      createdAt: normalizeNullableString(record, "created_at"),
      length: normalizeNullableInteger(record, "length"),
    },
  }
}

export async function fetchHitokotoSentence(
  fetchFn: HitokotoFetch = globalThis.fetch
) {
  const response = await fetchFn(buildHitokotoUrl())

  if (!response.ok) {
    throw new HitokotoFetchError(
      `Hitokoto request failed with status ${response.status}`
    )
  }

  return normalizeHitokotoResponse(await response.json())
}
