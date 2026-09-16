import type { Prisma, PrismaClient } from "@prisma/client"
import { issueInvitation, hashToken } from "@/lib/auth/invitation"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR } from "@/lib/rbac/presets"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { appBaseUrl } from "@/lib/appUrl"

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
  // Without this index signature, TS treats BootstrapEnv as a "weak type" (every
  // property optional) and refuses to assign process.env to it: ProcessEnv is
  // itself an index signature with no named property in common. This restates
  // that shape rather than widening it: every value here is already a string or
  // undefined.
  [key: string]: string | undefined
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

/**
 * Called once per server process at start-up. Refuses far more often than it
 * acts, and says so at most once, because the overwhelmingly common case is an
 * instance that was bootstrapped months ago.
 *
 * Nothing here throws. A replica that starts before the schema is ready, an
 * unreachable database, a half-supplied pair of variables: every one of them is
 * a log line. A failed bootstrap must not turn a running instance into a dead
 * one.
 */
// Only the transaction entry point, not the whole client. It states the single
// method this depends on, and it lets a test hand in a stub as a plain typed
// object: casting a fake PrismaClient would need a double cast, which this
// repository forbids for good reason.
export type BootstrapClient = {
  $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<BootstrapState>) => Promise<BootstrapState>
}

export async function bootstrapFirstAdmin(
  client: BootstrapClient,
  env: BootstrapEnv = process.env
): Promise<void> {
  const resolved = resolveBootstrapConfig(env)
  if (!resolved.ok) {
    if (!resolved.silent) console.warn(`[bootstrap] Refused: ${resolved.reason}.`)
    return
  }

  const { email, domain } = resolved.config

  try {
    const state = await client.$transaction(async (tx) => {
      const current = await bootstrapState(tx, email)
      if (current !== "closed") await createFirstAdmin(tx, resolved.config)
      return current
    })

    if (state === "closed") return

    // The token is never printed. It came from the operator's own configuration,
    // so they already hold it, and a log line carrying it would outlive the link
    // in whatever aggregator collects it.
    // Said differently on a resume, because a container that keeps the variables
    // runs this on every restart and "Created" would be a lie from the second one
    // onwards. The link is reissued either way, so the second line always holds.
    console.info(
      state === "fresh"
        ? `[bootstrap] Created company ${domain} and administrator ${email}.`
        : `[bootstrap] Reissued the invitation for ${email} at company ${domain}.`
    )
    console.info(`[bootstrap] Open ${appBaseUrl()}/invite with the token you supplied.`)
  } catch (error) {
    // A second replica booting at the same moment loses the race on one of the
    // unique constraints. That is the design holding, not a failure, so it reads
    // as one sentence rather than a constraint violation an operator would have
    // to decode on their first deploy.
    const raced =
      typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
    if (raced) {
      console.info("[bootstrap] Another replica bootstrapped first, nothing to do.")
      return
    }
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[bootstrap] Refused: ${detail}.`)
  }
}
