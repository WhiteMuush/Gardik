import type { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

type Db = Pick<PrismaClient, "account" | "stepUpGrant">

// A step-up grant proves the caller re-entered their password moments ago. It is
// required (on top of the permission and the no-escalation check) before a
// crown-jewel mutation, so a hijacked but idle session cannot silently escalate.
// Short-lived on purpose: long enough to finish one sensitive action, not long
// enough to be a standing capability.
export const STEP_UP_TTL_MS = 5 * 60 * 1000

// Re-verify the caller's own password against their credential account. Returns
// false when the user has no password account (SSO-only, a later plan) or the
// password is wrong; the caller maps false to a 401 so the UI re-prompts.
export async function verifyPassword(db: Db, userId: string, password: string): Promise<boolean> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  })
  if (!account?.password) return false
  return bcrypt.compare(password, account.password)
}

export async function grantStepUp(db: Db, userId: string): Promise<void> {
  await db.stepUpGrant.create({
    data: { userId, expiresAt: new Date(Date.now() + STEP_UP_TTL_MS) },
  })
}

export async function hasValidStepUp(db: Db, userId: string): Promise<boolean> {
  const grant = await db.stepUpGrant.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
  })
  return grant !== null
}
