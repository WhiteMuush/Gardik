import type { Prisma, PrismaClient } from "@prisma/client"
import { issueInvitation, hashToken } from "@/lib/auth/invitation"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR } from "@/lib/rbac/presets"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

// 24 hours rather than the 72 that INVITATION_TTL_HOURS gives a colleague being
// invited: a deployment is finished in one sitting or the next morning, and an
// expired bootstrap link is reissued by restarting the container, so the shorter
// window costs the operator nothing.
export const BOOTSTRAP_INVITATION_TTL_HOURS = 24

// The token is supplied by the operator rather than generated, so the container
// never has a secret to print. This floor is what stops a caller handing in
// something guessable; `openssl rand -base64 32` clears it comfortably.
export const MIN_BOOTSTRAP_TOKEN_LENGTH = 32

export type BootstrapConfig = { email: string; token: string; domain: string }

// silent distinguishes "nobody asked for a bootstrap", the normal state of every
// running instance and every development machine, from "somebody asked and got
// it wrong", which has to be said out loud.
export type ResolveResult =
  | { ok: true; config: BootstrapConfig }
  | { ok: false; silent: boolean; reason: string }

// Only the two keys this actually reads. Next.js augments NodeJS.ProcessEnv with a
// required NODE_ENV, so a test passing an object literal against that type would
// not compile; process.env stays assignable to this one.
export type BootstrapEnv = {
  BOOTSTRAP_ADMIN_EMAIL?: string
  BOOTSTRAP_INVITE_TOKEN?: string
}

export function resolveBootstrapConfig(env: BootstrapEnv): ResolveResult {
  const email = (env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase()
  const token = (env.BOOTSTRAP_INVITE_TOKEN ?? "").trim()

  if (email === "" && token === "") {
    return { ok: false, silent: true, reason: "not configured" }
  }
  if (email === "") {
    return { ok: false, silent: false, reason: "BOOTSTRAP_ADMIN_EMAIL is not set" }
  }
  if (token === "") {
    return { ok: false, silent: false, reason: "BOOTSTRAP_INVITE_TOKEN is not set" }
  }
  if (token.length < MIN_BOOTSTRAP_TOKEN_LENGTH) {
    return {
      ok: false,
      silent: false,
      reason: `BOOTSTRAP_INVITE_TOKEN is shorter than ${MIN_BOOTSTRAP_TOKEN_LENGTH} characters`,
    }
  }

  const at = email.lastIndexOf("@")
  const domain = at === -1 ? "" : email.slice(at + 1)
  if (at < 1 || !domain.includes(".") || /\s/.test(email)) {
    return { ok: false, silent: false, reason: "BOOTSTRAP_ADMIN_EMAIL is not a usable address" }
  }

  return { ok: true, config: { email, token, domain } }
}

type Db = PrismaClient | Prisma.TransactionClient

export type BootstrapState = "fresh" | "resumable" | "closed"

/**
 * The gate does not ask whether a user exists, it asks whether anyone can already
 * sign in. Under a plain "a user exists" rule a link lost or expired before use
 * would lock the operator out with no recovery short of dropping the database.
 * Resuming is safe because the door closes the moment an account carries a
 * password, which is the only thing that actually grants access.
 */
export async function bootstrapState(db: Db, email: string): Promise<BootstrapState> {
  const withPassword = await db.account.count({ where: { password: { not: null } } })
  if (withPassword > 0) return "closed"

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  return existing ? "resumable" : "fresh"
}

/**
 * Idempotent on purpose: the fresh and resumable states run the same path, and a
 * second run before the link is used leaves the existing invitation alone
 * instead of failing on it (see the tokenHash check below).
 *
 * No credential account is created. The password is set by the operator through
 * the invitation, under the application's own rules, so nothing here has to
 * restate them.
 */
export async function createFirstAdmin(db: Db, config: BootstrapConfig): Promise<void> {
  const company = await db.company.upsert({
    where: { domain: config.domain },
    update: {},
    create: { name: config.domain, domain: config.domain },
  })

  await seedPresetsForCompany(db, company.id)
  const roleId = await resolvePresetRoleId(db, company.id, ADMINISTRATOR)

  const user = await db.user.upsert({
    where: { email: config.email },
    update: {},
    create: { email: config.email, companyId: company.id, roleId },
  })

  // The operator supplies a fixed token rather than a generated one, so a second
  // run (a restart before the link is used) hashes to the exact same row
  // issueInvitation already created. Its unconditional create() would collide
  // on the tokenHash unique constraint, so a live invitation with this hash is
  // left untouched instead of being reissued: it is already the same link.
  const tokenHash = hashToken(config.token)
  const live = await db.userInvitation.findUnique({ where: { tokenHash } })
  if (!live || live.consumedAt) {
    await issueInvitation(db, {
      userId: user.id,
      createdByUserId: null,
      token: config.token,
      ttlHours: BOOTSTRAP_INVITATION_TTL_HOURS,
    })
  }

  for (const action of [AUDIT_ACTIONS.USER_CREATE, AUDIT_ACTIONS.USER_INVITE]) {
    await writeAudit(db, {
      companyId: company.id,
      actorUserId: null,
      action,
      targetType: "user",
      targetId: user.id,
    })
  }
}
