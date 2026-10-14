import { defineConfig } from "vitest/config"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

// Locally the database comes from .env.local, while CI sets the variables itself.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // The PDF module is .tsx, so oxc compiles JSX despite the tsconfig `jsx: preserve`.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.itest.ts"],
    // Files run one at a time, since they share one database and bootstrap.itest.ts deadlocked CI in parallel.
    fileParallelism: false,
  },
})
