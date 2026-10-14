import type { Permission } from "@/lib/rbac/permissions"

// The plugin opens provider management to any session, so these paths need a permission; sign-in stays open.
export const SSO_ADMIN_PATHS: Record<string, Permission> = {
  "/sso/register": "sso:config",
  "/sso/update-provider": "sso:config",
  "/sso/request-domain-verification": "sso:config",
  "/sso/verify-domain": "sso:config",
}

export function requiredPermissionFor(path: string): Permission | null {
  return SSO_ADMIN_PATHS[path] ?? null
}

// The exemption keeps an expired IdP certificate from locking a company out of its own security product.
export function deniesLocalSignIn(company: { ssoMandatory: boolean }, user: { ssoExempt: boolean }): boolean {
  return company.ssoMandatory && !user.ssoExempt
}
