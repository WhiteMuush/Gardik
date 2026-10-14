import { defineConfig } from "prisma/config"

// The repository config minus the dotenv load, since the container reads the URL from its environment.
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
