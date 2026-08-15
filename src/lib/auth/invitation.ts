import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import type { Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

// 72 hours: long enough to survive a weekend, short enough that a link sitting
// forgotten in a mailbox stops being a way in.
export const INVITATION_TTL_HOURS = 72

// Mirrors emailAndPassword in src/lib/auth/server.ts. The maximum is not
// cosmetic: bcrypt truncates at 72 bytes, so a longer passphrase would have its
// tail silently ignored and a user would believe in strength they do not have.
export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 72

/**
 * 32 random bytes, base64url. The security of the whole flow rests here: the
 * token is the only thing standing between an email inbox and a set password,
 * so it must be unguessable rather than merely unique.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * Only this ever reaches the database. Reading the table gives an attacker
 * hashes, which cannot be replayed against the accept endpoint. SHA-256 rather
 * than bcrypt on purpose: the input is 256 bits of entropy, so there is no
 * dictionary to slow down, and the accept path stays fast enough to rate-limit
 * meaningfully.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} bytes`
  }
  return null
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

/**
 * Issues a fresh invitation and voids every outstanding one for that user, so
 * re-inviting somebody cannot leave two live links behind (a resend after a
 * suspected leak has to actually retire the leaked one).
 *
 * Returns the raw token exactly once; it exists nowhere else afterwards.
 */
export async function issueInvitation(
  db: Db,
  { userId, createdByUserId, now = new Date() }: { userId: string; createdByUserId: string; now?: Date }
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000)

  await db.userInvitation.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: now },
  })

  await db.userInvitation.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, createdByUserId },
  })

  return { token, expiresAt }
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "weak_password"; message: string }

/**
 * Redeems an invitation: sets the account password, marks the address as
 * verified (clicking the link is the proof of control), clears any forced
 * rotation, and drops every existing session of that user.
 *
 * Callers must not distinguish the failure cases in what they return to the
 * network: "unknown", "already used" and "expired" all collapse into one
 * message so the endpoint cannot be used to probe which tokens ever existed.
 */
export async function consumeInvitation(
  db: PrismaClient,
  { token, password, now = new Date() }: { token: string; password: string; now?: Date }
): Promise<ConsumeResult> {
  const invalid = {
    ok: false as const,
    reason: "invalid" as const,
    message: "This invitation link is no longer valid",
  }

  const problem = passwordProblem(password)
  if (problem) return { ok: false, reason: "weak_password", message: problem }

  const invitation = await db.userInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  })
  if (!invitation || invitation.consumedAt || isExpired(invitation.expiresAt, now)) return invalid

  // Hashed outside the transaction: bcrypt at 12 rounds takes a few hundred
  // milliseconds, and holding a row lock for that long invites contention.
  const hashedPassword = await bcrypt.hash(password, 12)

  return db.$transaction(async (tx) => {
    // The claim and the check are the same statement, so two requests arriving
    // with the same token cannot both pass: exactly one gets count 1.
    const claimed = await tx.userInvitation.updateMany({
      where: { id: invitation.id, consumedAt: null },
      data: { consumedAt: now },
    })
    if (claimed.count !== 1) return invalid

    const credential = await tx.account.findFirst({
      where: { userId: invitation.userId, providerId: "credential" },
      select: { id: true },
    })
    if (credential) {
      await tx.account.update({ where: { id: credential.id }, data: { password: hashedPassword } })
    } else {
      await tx.account.create({
        data: {
          accountId: invitation.userId,
          providerId: "credential",
          userId: invitation.userId,
          password: hashedPassword,
        },
      })
    }

    await tx.user.update({
      where: { id: invitation.userId },
      data: { emailVerified: true, mustChangePassword: false },
    })

    // Anything already signed in as this user loses its session. If the
    // invitation was redeemed because the account was suspected compromised,
    // leaving the intruder's session alive would defeat the whole exercise.
    await tx.session.deleteMany({ where: { userId: invitation.userId } })

    return { ok: true as const, userId: invitation.userId }
  })
}
