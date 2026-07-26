import type { Permission } from "./permissions"

// Every mutating API route must appear here. The coverage test fails the build
// if a mutating route is missing. "PUBLIC" = no session (own auth or none).
// "AUTH_ONLY" = any authenticated user, no specific permission.
export const ROUTE_PERMISSIONS: Record<string, Permission | "PUBLIC" | "AUTH_ONLY"> = {
  "auth/[...all]": "PUBLIC",
  "health": "PUBLIC",
  "cron": "PUBLIC",
  "integrations/siem/[companyId]": "PUBLIC",
  "scim/[connectionId]/Users": "PUBLIC",
  "scim/[connectionId]/Users/[scimId]": "PUBLIC",

  "alerts/[id]": "alerts:status",
  "alerts/[id]/remediate": "alerts:remediate",
  "company": "policy:manage",
  "company/auth-policy": "policy:manage",
  "credentials": "api_credentials:manage",
  "credentials/[id]": "api_credentials:manage",
  "dashboard/config": "AUTH_ONLY",
  "dashboard/presets": "AUTH_ONLY",
  "dashboard/presets/[id]": "AUTH_ONLY",
  "dashboard/presets/[id]/activate": "AUTH_ONLY",
  "directory": "connectors:manage",
  "directory/[id]": "connectors:manage",
  "directory/[id]/sync": "connectors:sync",
  "directory/[id]/test": "connectors:sync",
  "employees/scan": "employees:scan",
  "register": "register:manage",
  "register/[id]": "register:manage",
  "rbac/step-up": "AUTH_ONLY",
  "roles": "roles:manage",
  "roles/[id]": "roles:manage",
  "reports/schedules": "reports:schedule",
  "reports/schedules/[id]": "reports:schedule",
  "webhooks": "notifications:manage",
  "webhooks/[id]": "notifications:manage",
  "webhooks/[id]/test": "notifications:manage",
}
