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
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.itest.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/*.itest.ts"],
      reporter: ["text-summary"],
      // Floor at today's unit coverage: it may only go up. Database code is
      // exercised by the integration suite, which this number leaves out.
      thresholds: { statements: 49, branches: 44, functions: 45, lines: 49 },
    },
  },
})
