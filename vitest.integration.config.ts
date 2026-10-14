import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

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
