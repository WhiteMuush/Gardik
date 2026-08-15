import type { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { burnPasswordTime, notFasterThan, MIN_VERIFY_MS } from "@/lib/auth/password-timing"

type Db = Pick<PrismaClient, "account" | "stepUpGrant">

// A step-up grant proves the caller re-entered their password moments ago. It is
// required (on top of the permission and the no-escalation check) before a
// crown-jewel mutation, so a hijacked but idle session cannot silently escalate.
// Short-lived on purpose: long enough to finish one sensitive action, not long
// enough to be a standing capability.
export const STEP_UP_TTL_MS = 5 * 60 * 1000

// Re-verify the caller's own password against their credential account. Returns
// false when the user has no password account (SSO-only) or the password is
// wrong; the caller maps false to a 401 so the UI re-prompts.
//
// Every outcome costs the same. Without the burn, "no password on this account"
// answered in a millisecond while a wrong password took a quarter of a second,
// and that gap is readable over the network: it says which accounts have
// passwords worth attacking. The floor covers the same ground for the rest of
// the work around the comparison.
export async function verifyPassword(db: Db, userId: string, password: string): Promise<boolean> {
  return notFasterThan(
    MIN_VERIFY_MS,
    (async () => {
      const account = await db.account.findFirst({
        where: { userId, providerId: "credential" },
        select: { password: true },
      })
      if (!account?.password) return burnPasswordTime(password)
      return bcrypt.compare(password, account.password)
    })()
  )
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
