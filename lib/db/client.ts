import { mkdirSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { drizzle } from "drizzle-orm/sqlite-proxy"

import * as schema from "./schema"

export function resolveDatabasePath() {
  const configuredPath = process.env.JUHUA_DATABASE_PATH

  if (configuredPath) {
    return isAbsolute(configuredPath) ? configuredPath : resolve(configuredPath)
  }

  return join(process.cwd(), "data", "juhua.sqlite")
}

export function createDatabaseClient() {
  const databasePath = resolveDatabasePath()
  mkdirSync(dirname(databasePath), { recursive: true })

  const sqlite = new DatabaseSync(databasePath)
  sqlite.exec("PRAGMA journal_mode = WAL")

  const db = drizzle(
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql)

      if (method === "run") {
        statement.run(...params)
        return { rows: [] }
      }

      if (method === "get") {
        const row = statement.get(...params)
        return { rows: row ? Object.values(row) : [] }
      }

      return { rows: statement.all(...params).map((row) => Object.values(row)) }
    },
    { schema }
  )

  return { db, sqlite }
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>
