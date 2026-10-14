import { type Permission } from "./permissions"

// Permissions over who can do what, so granting one also requires a fresh step-up (see step-up.ts).
export const CROWN_JEWELS: ReadonlySet<Permission> = new Set<Permission>([
  "roles:manage",
  "users:manage",
  "sso:config",
  "sso:role_map",
])

export function containsCrownJewel(perms: Iterable<string>): boolean {
  for (const p of perms) if (CROWN_JEWELS.has(p as Permission)) return true
  return false
}
