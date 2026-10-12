import { existsSync } from "node:fs"
import { defineConfig } from "prisma/config"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
