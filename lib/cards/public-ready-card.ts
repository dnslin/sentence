export const readyCardAccents = ["dawn", "rain", "moon"] as const

export type ReadyCardAccent = (typeof readyCardAccents)[number]
export type ReadyCardStatus = "ready"

export type PublicReadyCard = {
  id: string
  sentence: string
  sceneLabel: string
  accent: ReadyCardAccent
  status: ReadyCardStatus
}

export type ReadyCardResponse = {
  card: PublicReadyCard
}

export function isReadyCardAccent(value: string): value is ReadyCardAccent {
  return readyCardAccents.includes(value as ReadyCardAccent)
}
