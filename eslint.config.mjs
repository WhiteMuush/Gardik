import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Files over 200 lines, capped at their current size until #30 splits them.
const OVER_LIMIT = {
  "src/components/alerts/AlertTable.tsx": 271,
  "src/components/rbac/RolesManager.tsx": 269,
  "src/components/employees/EmployeeTable.tsx": 263,
  "src/components/dashboard/WidgetLibrary.tsx": 226,
  "src/contexts/DetailDrawerContext.tsx": 219,
  "src/components/rbac/UserRoleAssignment.tsx": 215,
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "prisma/migrations/**", "public/**"]),
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: { "max-lines": ["error", { max: 200 }] },
  },
  ...Object.entries(OVER_LIMIT).map(([file, max]) => ({
    files: [file.replace(/[\\[\]()]/g, "\\$&")],
    rules: { "max-lines": ["error", { max }] },
  })),
])
