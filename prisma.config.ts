import { existsSync } from "node:fs"
import { defineConfig } from "prisma/config"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
    // Only the schema drift check sets it, to replay the migrations in a throwaway database.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
