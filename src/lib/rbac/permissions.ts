// Fixed vocabulary of authorization permissions, "domain:action". A Role holds
// a validated subset of these. Namespaced so a domain can be subdivided later
// without breaking a role that held the broader grant. Adding a feature means
// adding its permissions here.
export const PERMISSIONS = Object.freeze([
  // Alerts (SOC core)
  "alerts:read", "alerts:assign", "alerts:status", "alerts:comment",
  "alerts:close", "alerts:remediate",
  // Employees (monitored subjects)
  "employees:read", "employees:manage", "employees:scan",
  // Exposure register
  "register:read", "register:manage", "register:evidence",
  // Dashboard
  "dashboard:read", "dashboard:customize", "dashboard:manage_shared",
  // Reports
  "reports:read", "reports:export", "reports:schedule",
  // Directory connectors
  "connectors:read", "connectors:manage", "connectors:sync",
  // Data API
  "api_credentials:read", "api_credentials:manage",
  // Notifications
  "notifications:read", "notifications:manage",
  // Security policy
  "policy:read", "policy:manage",
  // Identity / IdP
  "sso:read", "sso:config", "sso:role_map",
  // RBAC
  "users:read", "users:manage", "roles:read", "roles:manage",
  // Audit
  "audit:read",
] as const)

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_SET: ReadonlySet<Permission> = new Set(PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value as Permission)
}
