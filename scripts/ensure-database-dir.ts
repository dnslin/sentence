import { mkdirSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

const configuredDatabasePath = process.env.JUHUA_DATABASE_PATH
const databasePath = configuredDatabasePath
  ? isAbsolute(configuredDatabasePath)
    ? configuredDatabasePath
    : resolve(configuredDatabasePath)
  : join(process.cwd(), "data", "juhua.sqlite")

mkdirSync(dirname(databasePath), { recursive: true })
