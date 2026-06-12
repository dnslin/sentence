import { fetchHitokotoSentence, type HitokotoFetch } from "./hitokoto-client"
import { storeHitokotoSentence } from "./hitokoto-sentence-repository"

import type { DatabaseClient } from "@/lib/db/client"

export async function fetchAndStoreHitokotoSentence(input: {
  client: DatabaseClient
  fetchFn?: HitokotoFetch
}) {
  const sentence = await fetchHitokotoSentence(input.fetchFn)
  return storeHitokotoSentence(input.client, sentence)
}
