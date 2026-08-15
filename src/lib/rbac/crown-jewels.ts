import { type Permission } from "./permissions"

// Permissions that grant control over who can do what. Handing any of these out,
// or creating a role that holds one, is an escalation-sensitive act: it requires
// a fresh step-up re-auth (see step-up.ts) on top of the normal permission and
// the no-escalation subset check.
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
