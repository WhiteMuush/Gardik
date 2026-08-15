import { PERMISSIONS, type Permission } from "./permissions"

export const ADMINISTRATOR = "Administrator"
export const VIEWER_ROLE = "Viewer"

const READ_ONLY = PERMISSIONS.filter((p) => p.endsWith(":read")) as Permission[]

export const PRESETS = [
  {
    name: ADMINISTRATOR,
    description: "Full access. Built-in, cannot be edited or deleted.",
    permissions: [...PERMISSIONS] as Permission[],
    isSystem: true,
    isAssignable: true,
  },
  {
    name: "Security Manager",
    description: "Manages policy, connectors, SSO config, users and reports. Cannot manage roles or the group->role map.",
    permissions: [
      "policy:read", "policy:manage",
      "connectors:read", "connectors:manage", "connectors:sync",
      "sso:read", "sso:config",
      "users:read", "users:manage", "roles:read",
      "reports:read", "reports:export", "reports:schedule",
      "alerts:read", "employees:read", "register:read", "dashboard:read",
      "api_credentials:read", "notifications:read", "audit:read",
    ] as Permission[],
    isSystem: false,
    isAssignable: true,
  },
  {
    name: "SOC Analyst",
    description: "Operates on alerts, runs scans, manages the exposure register.",
    permissions: [
      "alerts:read", "alerts:assign", "alerts:status", "alerts:comment",
      "alerts:close", "alerts:remediate",
      "employees:read", "employees:scan",
      "register:read", "register:manage", "register:evidence",
      "reports:read", "reports:export",
      "dashboard:read", "dashboard:customize",
      "connectors:read", "notifications:read", "api_credentials:read",
      "policy:read", "sso:read", "users:read", "roles:read", "audit:read",
    ] as Permission[],
    isSystem: false,
    isAssignable: true,
  },
  {
    name: VIEWER_ROLE,
    description: "Read-only across the workspace.",
    permissions: READ_ONLY,
    isSystem: false,
    isAssignable: true,
  },
] as const

export type Preset = (typeof PRESETS)[number]
