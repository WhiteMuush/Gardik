import type { Permission } from "@/lib/rbac/permissions"

// The plugin exposes provider management to any authenticated session, which
// would let a Viewer enroll an IdP on their own company. Sign-in and callback
// stay open by design: they are the login path.
export const SSO_ADMIN_PATHS: Record<string, Permission> = {
  "/sso/register": "sso:config",
  "/sso/update-provider": "sso:config",
  "/sso/request-domain-verification": "sso:config",
  "/sso/verify-domain": "sso:config",
}

export function requiredPermissionFor(path: string): Permission | null {
  return SSO_ADMIN_PATHS[path] ?? null
}
