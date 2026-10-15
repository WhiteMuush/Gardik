import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // The PDF module is .tsx, so oxc compiles JSX despite the tsconfig `jsx: preserve`.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.itest.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/*.itest.ts", "src/lib/**/*.fixtures.ts"],
      reporter: ["text-summary"],
      // Floor at today's unit coverage, raise it as tests are added.
      thresholds: { statements: 57, branches: 52, functions: 51, lines: 58 },
    },
  },
})
