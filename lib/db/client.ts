import { mkdirSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { drizzle } from "drizzle-orm/sqlite-proxy"

import * as schema from "./schema"

import type { RemoteCallback } from "drizzle-orm/sqlite-proxy"

export function resolveDatabasePath() {
  const configuredPath = process.env.JUHUA_DATABASE_PATH

  if (configuredPath) {
    return isAbsolute(configuredPath) ? configuredPath : resolve(configuredPath)
  }

  return join(process.cwd(), "data", "juhua.sqlite")
}

export function ensureDatabaseDirectory(databasePath = resolveDatabasePath()) {
  mkdirSync(dirname(databasePath), { recursive: true })
}

export function createDatabaseClient() {
  const databasePath = resolveDatabasePath()
  ensureDatabaseDirectory(databasePath)

  const sqlite = new DatabaseSync(databasePath)
  sqlite.exec("PRAGMA foreign_keys = ON")
  sqlite.exec("PRAGMA journal_mode = WAL")

  const query: RemoteCallback = async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    statement.setReturnArrays(true)

    if (method === "run") {
      statement.run(...params)
      return { rows: [] }
    }

    if (method === "get") {
      const row = statement.get(...params) as unknown[] | undefined
      return { rows: row ? row : [] }
    }

    return { rows: statement.all(...params) as unknown as unknown[][] }
  }

  const db = drizzle(
    query,
    async (batch) => {
      sqlite.exec("BEGIN")

      try {
        const results = []

        for (const item of batch) {
          results.push(await query(item.sql, item.params, item.method))
        }

        sqlite.exec("COMMIT")
        return results
      } catch (error) {
        sqlite.exec("ROLLBACK")
        throw error
      }
    },
    { schema }
  )

  return { db, sqlite }
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>

export async function runImmediateTransaction<T>(
  client: DatabaseClient,
  callback: () => Promise<T>
): Promise<T> {
  client.sqlite.exec("BEGIN IMMEDIATE")

  try {
    const result = await callback()
    client.sqlite.exec("COMMIT")
    return result
  } catch (error) {
    client.sqlite.exec("ROLLBACK")
    throw error
  }
}
