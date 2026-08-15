import type { Permission } from "./permissions"

// Every dashboard page and the permission needed to open it. The API side has
// had this since the beginning (see route-permissions.ts); pages did not, and
// most of them only used their permission to decide what to draw. Typing the
// path into the address bar reached the page anyway, loaded the company's data
// server-side, and rendered a read-only view of things the role was never
// granted.
//
// "AUTH_ONLY" means any signed-in user of the company: pages about the caller's
// own account rather than the company's data.
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
  // The caller's own sign-in methods. Reachable by everyone, but guarded by a
  // step-up on the page itself: it is where a session can be turned into
  // lasting access (a new authenticator, a passkey), so a borrowed unlocked
  // screen should not be enough.
  "/security": "AUTH_ONLY",
  "/setup": "AUTH_ONLY",
}

/**
 * Resolves the permission guarding a path, matching the longest declared
 * prefix so nested routes inherit their section's rule.
 *
 * Returns null for anything undeclared, and callers must treat null as a
 * refusal. A page added without an entry here is inaccessible rather than
 * unguarded, which is the failure the coverage test then points at by name.
 */
export function requiredPermissionForPage(pathname: string): Permission | "AUTH_ONLY" | null {
  if (pathname in PAGE_PERMISSIONS) return PAGE_PERMISSIONS[pathname]

  let best: { path: string; permission: Permission | "AUTH_ONLY" } | null = null
  for (const [path, permission] of Object.entries(PAGE_PERMISSIONS)) {
    if (!pathname.startsWith(`${path}/`)) continue
    if (!best || path.length > best.path.length) best = { path, permission }
  }
  return best?.permission ?? null
}
