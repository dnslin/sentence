import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { ensureDatabaseDirectory, resolveDatabasePath } from "@/lib/db/client"

const databasePath = resolveDatabasePath()
const migrationsPath = join(process.cwd(), "drizzle")

ensureDatabaseDirectory(databasePath)

const sqlite = new DatabaseSync(databasePath)

type MigrationRow = {
  name: string
}

function isMigrationRow(row: unknown): row is MigrationRow {
  return typeof row === "object" && row !== null && typeof (row as { name?: unknown }).name === "string"
}

try {
  sqlite.exec("PRAGMA journal_mode = WAL")
  // This first local migration runner records filenames only. Checksum validation
  // is deferred until there are mutable production migrations to protect.
  sqlite.exec("CREATE TABLE IF NOT EXISTS __drizzle_migrations (name text PRIMARY KEY NOT NULL, applied_at integer NOT NULL)")

  const appliedRows = sqlite.prepare("SELECT name FROM __drizzle_migrations").all()
  const applied = new Set(appliedRows.filter(isMigrationRow).map((row) => row.name))

  const migrationFiles = readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  for (const file of migrationFiles) {
    if (applied.has(file)) continue

    const sql = readFileSync(join(migrationsPath, file), "utf8").replaceAll("--> statement-breakpoint", "")
    sqlite.exec("BEGIN")

    try {
      sqlite.exec(sql)
      sqlite.prepare("INSERT INTO __drizzle_migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now())
      sqlite.exec("COMMIT")
    } catch (error) {
      sqlite.exec("ROLLBACK")
      throw error
    }
  }
} finally {
  sqlite.close()
}
