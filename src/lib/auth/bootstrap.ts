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
 * second run reissues the invitation rather than failing on it. The operator's
 * bootstrap variables normally stay in their compose file, so this runs on every
 * container restart, and each run hands back a link with a fresh window.
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

  // Read before the upsert, so the audit trail can tell a creation from a resume.
  // Without it every restart of a container that still carries the bootstrap
  // variables appends another user.create for a user it did not create, to the
  // one record whose entire purpose is to be true.
  const existing = await db.user.findUnique({
    where: { email: config.email },
    select: { id: true },
  })

  const user = await db.user.upsert({
    where: { email: config.email },
    update: {},
    create: { email: config.email, companyId: company.id, roleId },
  })

  // UserInvitation.tokenHash is unique, and issueInvitation marks outstanding
  // invitations consumed rather than deleting them. The bootstrap token is fixed
  // by the operator, so every restart of a container that still carries the
  // variables would re-create the same hash and violate that constraint. Clearing
  // the unredeemed row first removes nothing of value, keeps issueInvitation as
  // the single writer of invitations, and refreshes the window on every restart.
  await db.userInvitation.deleteMany({
    where: { tokenHash: hashToken(config.token), consumedAt: null },
  })

  await issueInvitation(db, {
    userId: user.id,
    createdByUserId: null,
    token: config.token,
    ttlHours: BOOTSTRAP_INVITATION_TTL_HOURS,
  })

  const entry = { companyId: company.id, actorUserId: null, targetType: "user", targetId: user.id }
  if (!existing) await writeAudit(db, { ...entry, action: AUDIT_ACTIONS.USER_CREATE })
  await writeAudit(db, { ...entry, action: AUDIT_ACTIONS.USER_INVITE })
}
