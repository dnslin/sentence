import { rmSync } from "node:fs"

import { resolveDatabasePath } from "@/lib/db/client"

const databasePath = resolveDatabasePath()

for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
  rmSync(path, { force: true })
}
