import { defineConfig } from "drizzle-kit"

const databasePath = process.env.JUHUA_DATABASE_PATH ?? "data/juhua.sqlite"

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
})
