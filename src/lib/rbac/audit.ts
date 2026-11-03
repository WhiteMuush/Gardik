import type { PrismaClient, Prisma } from "@prisma/client"

type Db = Pick<PrismaClient, "auditLog">

// Closed set of audited actions, so call sites cannot typo one and readers (audit UI, SIEM) can switch on it.
export const AUDIT_ACTIONS = {
  ROLE_CREATE: "role.create",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",
  USER_CREATE: "user.create",
  USER_ROLE_ASSIGN: "user.role.assign",
  USER_INVITE: "user.invite",
  USER_INVITE_ACCEPT: "user.invite.accept",
  USER_PASSWORD_ROTATION_REQUIRED: "user.password.rotation_required",
  USER_PASSWORD_CHANGE: "user.password.change",
  USER_PROFILE_UPDATE: "user.profile.update",
  USER_SESSION_REVOKE: "user.session.revoke",
  USER_2FA_ENABLE: "user.2fa.enable",
  USER_2FA_DISABLE: "user.2fa.disable",
  USER_PASSKEY_ADD: "user.passkey.add",
  USER_PASSKEY_REMOVE: "user.passkey.remove",
  SSO_PROVIDER_CREATE: "sso.provider.create",
  SSO_PROVIDER_UPDATE: "sso.provider.update",
  SSO_PROVIDER_DELETE: "sso.provider.delete",
  SSO_DOMAIN_VERIFY: "sso.domain.verify",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export type AuditEntry = {
  companyId: string
  actorUserId: string | null
  action: AuditAction
  targetType: string
  targetId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
}

// The only writer, append-only, with before/after snapshots so a change reads without joining a deleted row.
export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      companyId: entry.companyId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: entry.ip ?? null,
    },
  })
}
