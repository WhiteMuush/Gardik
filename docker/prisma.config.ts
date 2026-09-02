import { defineConfig } from "prisma/config"

// Prisma config shipped inside the production image. Same as the repository
// prisma.config.ts minus the dotenv load: the container has no .env.local and
// the database URL always comes from the runtime environment.
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
