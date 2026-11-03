import type { PrismaClient } from "@prisma/client"
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { prisma } from "@/lib/prisma"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Db = Pick<PrismaClient, "auditLog">

type ToggledUser = { id: string; companyId?: unknown; twoFactorEnabled?: unknown }

type CallerSession = {
  user: { id: string; companyId?: unknown }
  session: { ipAddress?: string | null }
} | null

// Better Auth only rewrites the user row on these paths when it actually flips twoFactorEnabled.
export async function recordTwoFactorToggle(
  db: Db,
  user: ToggledUser,
  path: string | undefined,
  ip: string | null
): Promise<void> {
  if (!path?.startsWith("/two-factor/") || typeof user.companyId !== "string") return
  await writeAudit(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    action: user.twoFactorEnabled === true ? AUDIT_ACTIONS.USER_2FA_ENABLE : AUDIT_ACTIONS.USER_2FA_DISABLE,
    targetType: "User",
    targetId: user.id,
    ip,
  })
}

function passkeyChange(path: string, body: unknown, returned: unknown) {
  if (path === "/passkey/verify-registration") {
    const id = (returned as { id?: unknown }).id
    return typeof id === "string" ? { action: AUDIT_ACTIONS.USER_PASSKEY_ADD, targetId: id } : null
  }
  if (path === "/passkey/delete-passkey" && (returned as { status?: unknown }).status === true) {
    const id = (body as { id?: unknown } | undefined)?.id
    return typeof id === "string" ? { action: AUDIT_ACTIONS.USER_PASSKEY_REMOVE, targetId: id } : null
  }
  return null
}

export async function recordPasskeyEvent(
  db: Db,
  event: { path: string; body: unknown; returned: unknown; session: CallerSession }
): Promise<void> {
  const { session, returned } = event
  if (!session || typeof session.user.companyId !== "string") return
  if (returned === null || typeof returned !== "object" || returned instanceof Error) return
  const change = passkeyChange(event.path, event.body, returned)
  if (!change) return
  await writeAudit(db, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: change.action,
    targetType: "Passkey",
    targetId: change.targetId,
    ip: session.session.ipAddress ?? null,
  })
}

// Written after Better Auth commits the change, so unlike Gardik's own routes it shares no transaction with it.
export const auditPasskeyEvents = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/passkey/")) return
  await recordPasskeyEvent(prisma, {
    path: ctx.path,
    body: ctx.body,
    returned: ctx.context.returned,
    session: await getSessionFromCtx(ctx),
  })
})

export async function auditTwoFactorToggle(
  user: ToggledUser,
  ctx: { path?: string; context: { session: CallerSession } } | null
): Promise<void> {
  await recordTwoFactorToggle(prisma, user, ctx?.path, ctx?.context.session?.session.ipAddress ?? null)
}
