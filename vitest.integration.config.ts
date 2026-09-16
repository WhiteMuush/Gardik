import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // The PDF report module is authored as .tsx (react-pdf primitives); override
  // the tsconfig `jsx: preserve` so the test transformer (oxc) compiles it.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.itest.ts"],
    // Every file here talks to the same database, so they were never actually
    // independent, and running them in parallel only worked by luck of timing.
    // src/lib/auth/bootstrap.itest.ts has to empty the Company table to reach
    // the states its gate exists to distinguish, which takes locks the other
    // suites are writing behind, and CI eventually deadlocked on it. Files run
    // one at a time; tests inside a file already did.
    fileParallelism: false,
  },
})
