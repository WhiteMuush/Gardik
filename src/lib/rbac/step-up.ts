import type { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { burnPasswordTime, notFasterThan, MIN_VERIFY_MS } from "@/lib/auth/password-timing"

type Db = Pick<PrismaClient, "account" | "stepUpGrant">

// A step-up grant proves a recent password re-entry, short-lived so it never becomes a standing capability.
export const STEP_UP_TTL_MS = 5 * 60 * 1000

// False for an SSO-only account or a wrong password, and every outcome costs the same so timing reveals nothing.
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
