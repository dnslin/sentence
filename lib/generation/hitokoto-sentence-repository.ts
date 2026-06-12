import { randomUUID } from "node:crypto"

import { eq, or } from "drizzle-orm"

import { hitokotoSentenceMetadata, sentences } from "@/lib/db/schema"

import type { DatabaseClient } from "@/lib/db/client"
import type { NormalizedHitokotoSentence } from "./hitokoto-client"

export type StoredHitokotoSentence = {
  sentenceId: string
  sentenceText: string
  sourceIdentity: string
  hitokotoUuid: string | null
  inserted: boolean
}

async function findStoredHitokotoSentence(
  client: DatabaseClient,
  sentence: NormalizedHitokotoSentence
): Promise<StoredHitokotoSentence | null> {
  const identityConditions = [
    eq(hitokotoSentenceMetadata.sourceIdentity, sentence.sourceIdentity),
  ]

  if (sentence.hitokotoUuid) {
    identityConditions.push(
      eq(hitokotoSentenceMetadata.hitokotoUuid, sentence.hitokotoUuid)
    )
  }

  const [row] = await client.db
    .select({
      sentenceId: sentences.id,
      sentenceText: sentences.text,
      sourceIdentity: hitokotoSentenceMetadata.sourceIdentity,
      hitokotoUuid: hitokotoSentenceMetadata.hitokotoUuid,
    })
    .from(hitokotoSentenceMetadata)
    .innerJoin(sentences, eq(hitokotoSentenceMetadata.sentenceId, sentences.id))
    .where(or(...identityConditions))
    .limit(1)

  if (!row) return null

  return {
    sentenceId: row.sentenceId,
    sentenceText: row.sentenceText,
    sourceIdentity: row.sourceIdentity,
    hitokotoUuid: row.hitokotoUuid,
    inserted: false,
  }
}

async function insertHitokotoSentence(
  client: DatabaseClient,
  sentence: NormalizedHitokotoSentence
): Promise<StoredHitokotoSentence> {
  const sentenceId = randomUUID()
  const now = new Date()

  await client.db.insert(sentences).values({
    id: sentenceId,
    text: sentence.text,
    source: sentence.source,
    createdAt: now,
  })

  await client.db.insert(hitokotoSentenceMetadata).values({
    sentenceId,
    hitokotoUuid: sentence.hitokotoUuid,
    sourceIdentity: sentence.sourceIdentity,
    hitokotoId: sentence.metadata.hitokotoId,
    type: sentence.metadata.type,
    fromText: sentence.metadata.from,
    fromWho: sentence.metadata.fromWho,
    creator: sentence.metadata.creator,
    creatorUid: sentence.metadata.creatorUid,
    reviewer: sentence.metadata.reviewer,
    commitFrom: sentence.metadata.commitFrom,
    hitokotoCreatedAt: sentence.metadata.createdAt,
    length: sentence.metadata.length,
    fetchedAt: now,
  })

  return {
    sentenceId,
    sentenceText: sentence.text,
    sourceIdentity: sentence.sourceIdentity,
    hitokotoUuid: sentence.hitokotoUuid,
    inserted: true,
  }
}

export async function storeHitokotoSentence(
  client: DatabaseClient,
  sentence: NormalizedHitokotoSentence
): Promise<StoredHitokotoSentence> {
  client.sqlite.exec("BEGIN IMMEDIATE")

  try {
    const existing = await findStoredHitokotoSentence(client, sentence)
    const stored = existing ?? (await insertHitokotoSentence(client, sentence))
    client.sqlite.exec("COMMIT")
    return stored
  } catch (error) {
    client.sqlite.exec("ROLLBACK")
    throw error
  }
}
