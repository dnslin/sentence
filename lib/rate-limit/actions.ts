export const rateLimitWindowMs = 60 * 60 * 1000
export const rateLimitedActions = ["refresh", "download", "share"] as const

export type RateLimitedAction = (typeof rateLimitedActions)[number]

export const cardActionNames = [
  "download",
  "share",
] as const satisfies readonly RateLimitedAction[]
export type CardActionName = (typeof cardActionNames)[number]

type RateLimitConfig = {
  limit: number
  windowMs: typeof rateLimitWindowMs
}

export const rateLimitConfigs = {
  refresh: { limit: 120, windowMs: rateLimitWindowMs },
  download: { limit: 60, windowMs: rateLimitWindowMs },
  share: { limit: 60, windowMs: rateLimitWindowMs },
} as const satisfies Record<RateLimitedAction, RateLimitConfig>

export function isRateLimitedAction(
  value: unknown
): value is RateLimitedAction {
  return (
    typeof value === "string" &&
    rateLimitedActions.includes(value as RateLimitedAction)
  )
}
