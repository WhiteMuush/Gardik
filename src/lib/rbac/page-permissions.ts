import type { Permission } from "./permissions"

// Every dashboard page and its permission, where "AUTH_ONLY" means any signed-in user (own-account pages).
export const PAGE_PERMISSIONS: Record<string, Permission | "AUTH_ONLY"> = {
  "/dashboard": "dashboard:read",
  "/dashboard/widgets": "dashboard:customize",
  "/employees": "employees:read",
  "/alerts": "alerts:read",
  "/reports": "reports:read",
  "/register": "register:read",
  "/data-sources": "connectors:read",
  "/data-api": "api_credentials:read",
  "/notifications": "notifications:read",
  "/access": "roles:read",
  // Open to everyone but step-up guarded on the page, since it turns a session into lasting access.
  "/security": "AUTH_ONLY",
  "/setup": "AUTH_ONLY",
  "/preferences": "AUTH_ONLY",
}

// The longest declared prefix wins, and null (undeclared) must be treated as a refusal.
export function requiredPermissionForPage(pathname: string): Permission | "AUTH_ONLY" | null {
  const exact = PAGE_PERMISSIONS[pathname]
  if (exact) return exact

  let best: { path: string; permission: Permission | "AUTH_ONLY" } | null = null
  for (const [path, permission] of Object.entries(PAGE_PERMISSIONS)) {
    if (!pathname.startsWith(`${path}/`)) continue
    if (!best || path.length > best.path.length) best = { path, permission }
  }
  return best?.permission ?? null
}

// Paths a permission set may open, resolved once by the layout so client components never re-derive the rule.
export function visiblePages(perms: ReadonlySet<string>): string[] {
  return Object.entries(PAGE_PERMISSIONS)
    .filter(([, permission]) => permission === "AUTH_ONLY" || perms.has(permission))
    .map(([path]) => path)
}

// Landing path resolved from the role, preferring a section root, with the own-account pages as the floor.
export function landingPath(perms: ReadonlySet<string>): string {
  const open = visiblePages(perms)
  return open.find((path) => path.lastIndexOf("/") === 0) ?? open[0] ?? "/login"
}
