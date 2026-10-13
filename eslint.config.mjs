import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Files over 200 lines, capped at their current size until #30 splits them.
const OVER_LIMIT = {
  "src/components/dashboard/DashboardCanvas.tsx": 734,
  "src/lib/sso/sso.itest.ts": 708,
  "src/components/settings/ConnectWizard.tsx": 586,
  "src/components/settings/SsoSettings.tsx": 566,
  "src/lib/reports/pdf.tsx": 542,
  "src/app/(auth)/login/page.tsx": 540,
  "src/components/settings/SetupGuides.tsx": 487,
  "src/lib/dashboard.ts": 408,
  "src/lib/auth/invitation-routes.itest.ts": 400,
  "src/lib/scan/runner.ts": 394,
  "src/components/reports/ReportCanvas.tsx": 393,
  "src/components/credentials/SourceDrawer.tsx": 349,
  "src/app/(dashboard)/dashboard/page.tsx": 345,
  "src/lib/scan/runner.test.ts": 334,
  "src/lib/auth/server.ts": 313,
  "src/lib/sso/user-create.itest.ts": 311,
  "src/components/settings/DirectoryConnections.tsx": 275,
  "src/components/alerts/AlertTable.tsx": 271,
  "src/components/rbac/RolesManager.tsx": 269,
  "src/lib/auth/bootstrap.itest.ts": 263,
  "src/components/employees/EmployeeTable.tsx": 263,
  "src/lib/auth/invitation.itest.ts": 242,
  "src/lib/sso/round-trip.itest.ts": 227,
  "src/components/dashboard/WidgetLibrary.tsx": 226,
  "src/contexts/DetailDrawerContext.tsx": 219,
  "src/components/rbac/UserRoleAssignment.tsx": 215,
  "src/components/credentials/SourceCatalog.tsx": 215,
  "src/lib/auth/bootstrap.ts": 211,
  "src/app/api/dashboard/detail/[kind]/[id]/route.ts": 209,
  "scripts/check-licenses.mjs": 201,
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
