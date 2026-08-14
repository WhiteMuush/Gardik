import type { PrismaClient, Prisma } from "@prisma/client"

type Db = Pick<PrismaClient, "auditLog">

// Closed vocabulary of audited actions. Kept as constants so call sites cannot
// typo an action string and so a later reader (audit UI, SIEM) can switch on a
// known set. SSO and policy actions get appended by their own plans.
export const AUDIT_ACTIONS = {
  ROLE_CREATE: "role.create",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",
  USER_ROLE_ASSIGN: "user.role.assign",
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

// Append-only: this is the ONLY writer, and there is no update or delete path.
// before/after are stored as JSON snapshots so a reviewer can see what changed
// without joining to a possibly-since-deleted row.
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
