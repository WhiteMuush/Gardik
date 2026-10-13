import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "prisma/migrations/**", "public/**"]),
  {
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["**/*.test.ts", "**/*.itest.ts", "e2e/**"],
    rules: { "max-lines": ["error", { max: 500 }] },
  },
  {
    // Already over the limit: each file leaves this list once it is split (#30).
    files: [
      "src/components/dashboard/DashboardCanvas.tsx",
      "src/components/settings/ConnectWizard.tsx",
      "src/components/settings/SsoSettings.tsx",
      "src/lib/reports/pdf.tsx",
      "src/app/(auth)/login/page.tsx",
    ],
    rules: { "max-lines": "off" },
  },
])
