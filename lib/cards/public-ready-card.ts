export const readyCardAccents = ["dawn", "rain", "moon"] as const

export type ReadyCardAccent = (typeof readyCardAccents)[number]
export type ReadyCardStatus = "ready"

export type PublicReadyCard = {
  id: string
  sentence: string
  sceneLabel: string
  accent: ReadyCardAccent
  status: ReadyCardStatus
  illustrationUrl: string | null
}

export type ReadyCardResponse = {
  card: PublicReadyCard
}

export type ReadyCardUnavailableReason = "ready_card_not_found"
export type ReadyCardLimitReason = "ready_card_limited"

export type ReadyCardErrorResponse = {
  error: ReadyCardUnavailableReason
  message: string
}

export type ReadyCardLimitErrorResponse = {
  error: ReadyCardLimitReason
  message: string
}

export const cardActionNames = ["download", "share"] as const
export type CardActionName = (typeof cardActionNames)[number]

export type CardActionRequest = {
  action: CardActionName
}

export type CardActionResponse = {
  action: CardActionName
  status: "allowed"
  message: string
}

export type CardActionInvalidResponse = {
  error: "invalid_card_action"
  message: string
}

export function isReadyCardAccent(value: string): value is ReadyCardAccent {
  return readyCardAccents.includes(value as ReadyCardAccent)
}

export function isPublicReadyCard(value: unknown): value is PublicReadyCard {
  if (typeof value !== "object" || value === null) return false

  const card = value as Record<string, unknown>

  return (
    typeof card.id === "string" &&
    typeof card.sentence === "string" &&
    typeof card.sceneLabel === "string" &&
    (typeof card.illustrationUrl === "string" ||
      card.illustrationUrl === null) &&
    typeof card.accent === "string" &&
    isReadyCardAccent(card.accent) &&
    card.status === "ready"
  )
}

export function isReadyCardResponse(
  value: unknown
): value is ReadyCardResponse {
  if (typeof value !== "object" || value === null) return false

  return isPublicReadyCard((value as { card?: unknown }).card)
}

export function isReadyCardUnavailableReason(
  value: unknown
): value is ReadyCardUnavailableReason {
  return value === "ready_card_not_found"
}

export function isReadyCardErrorResponse(
  value: unknown
): value is ReadyCardErrorResponse {
  if (typeof value !== "object" || value === null) return false

  const response = value as Record<string, unknown>

  return (
    isReadyCardUnavailableReason(response.error) &&
    typeof response.message === "string"
  )
}

export function isReadyCardLimitErrorResponse(
  value: unknown
): value is ReadyCardLimitErrorResponse {
  if (typeof value !== "object" || value === null) return false

  const response = value as Record<string, unknown>

  return (
    response.error === "ready_card_limited" &&
    typeof response.message === "string"
  )
}

export function isCardActionName(value: unknown): value is CardActionName {
  return (
    typeof value === "string" &&
    cardActionNames.includes(value as CardActionName)
  )
}

export function isCardActionRequest(
  value: unknown
): value is CardActionRequest {
  if (typeof value !== "object" || value === null) return false

  return isCardActionName((value as { action?: unknown }).action)
}

export function isCardActionResponse(
  value: unknown
): value is CardActionResponse {
  if (typeof value !== "object" || value === null) return false

  const response = value as Record<string, unknown>

  return (
    isCardActionName(response.action) &&
    response.status === "allowed" &&
    typeof response.message === "string"
  )
}
