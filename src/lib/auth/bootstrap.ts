import type { Prisma, PrismaClient } from "@prisma/client"
import { issueInvitation, hashToken } from "@/lib/auth/invitation"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR } from "@/lib/rbac/presets"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { appBaseUrl } from "@/lib/appUrl"

// A deployment finishes in one sitting and a restart reissues the link, so 24 hours is enough.
export const BOOTSTRAP_INVITATION_TTL_HOURS = 24

// The operator supplies the token, so this floor is what refuses a guessable one.
export const MIN_BOOTSTRAP_TOKEN_LENGTH = 32

export type BootstrapConfig = { email: string; token: string; domain: string }

// silent: no bootstrap was asked for (the normal state), as opposed to one asked for wrongly.
export type ResolveResult =
  { ok: true; config: BootstrapConfig } | { ok: false; silent: boolean; reason: string }

// Only the two keys read here, so a test can pass a plain object where ProcessEnv would demand NODE_ENV.
export type BootstrapEnv = {
  BOOTSTRAP_ADMIN_EMAIL?: string
  BOOTSTRAP_INVITE_TOKEN?: string
  // Lets process.env, itself an index signature, be assigned to this otherwise weak type.
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

// The door closes once any account has a password, so a lost link never locks the operator out.
export async function bootstrapState(db: Db, email: string): Promise<BootstrapState> {
  const withPassword = await db.account.count({ where: { password: { not: null } } })
  if (withPassword > 0) return "closed"

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  return existing ? "resumable" : "fresh"
}

// Idempotent: every restart reissues the invitation, and the password is set through it, never here.
export async function createFirstAdmin(db: Db, config: BootstrapConfig): Promise<void> {
  const company = await db.company.upsert({
    where: { domain: config.domain },
    update: {},
    create: { name: config.domain, domain: config.domain },
  })

  await seedPresetsForCompany(db, company.id)
  const roleId = await resolvePresetRoleId(db, company.id, ADMINISTRATOR)

  // Read before the upsert, so a restart is audited as an invitation and never as a new user.
  const existing = await db.user.findUnique({
    where: { email: config.email },
    select: { id: true },
  })

  const user = await db.user.upsert({
    where: { email: config.email },
    update: {},
    create: { email: config.email, companyId: company.id, roleId },
  })

  // The operator token never changes and tokenHash is unique, so the unredeemed row goes first.
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

// Only the transaction entry point, so a test can pass a typed stub instead of a cast client.
export type BootstrapClient = {
  $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<BootstrapState>) => Promise<BootstrapState>
}

// Runs at each server start and never throws: a failed bootstrap must not take down a running instance.
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

    // The token is never logged, and a resume is worded as a reissue rather than a creation.
    console.info(
      state === "fresh"
        ? `[bootstrap] Created company ${domain} and administrator ${email}.`
        : `[bootstrap] Reissued the invitation for ${email} at company ${domain}.`
    )
    console.info(`[bootstrap] Open ${appBaseUrl()}/invite with the token you supplied.`)
  } catch (error) {
    // A replica booting at the same moment loses on a unique constraint, which is the design holding.
    const raced = typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
    if (raced) {
      console.info("[bootstrap] Another replica bootstrapped first, nothing to do.")
      return
    }
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[bootstrap] Refused: ${detail}.`)
  }
}
