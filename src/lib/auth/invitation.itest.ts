import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { issueInvitation, consumeInvitation, hashToken, INVITATION_TTL_HOURS } from "./invitation"
import { invitationFixture } from "./invitation.fixtures"

// Issuing invitations: only a hash is stored, links expire, and a new link voids the old one.
const { ctx, makeUser } = invitationFixture("issue")

describe("issueInvitation", () => {
  it("stores only a hash, never anything that can be replayed", async () => {
    const user = await makeUser("stores-hash")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    const rows = await prisma.userInvitation.findMany({ where: { userId: user.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).toBe(hashToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
  })

  it("expires the link the configured number of hours out", async () => {
    const user = await makeUser("ttl")
    const now = new Date("2026-08-15T12:00:00Z")
    const { expiresAt } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: ctx.inviterId,
      now,
    })
    expect(expiresAt.getTime() - now.getTime()).toBe(INVITATION_TTL_HOURS * 60 * 60 * 1000)
  })

  // Re-inviting after a suspected leak has to retire the leaked link, or the
  // resend hands the attacker a second chance rather than closing the first.
  it("voids the previous link when a new one is issued", async () => {
    const user = await makeUser("supersede")
    const first = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })
    await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    const result = await consumeInvitation(prisma, {
      token: first.token,
      password: "a-perfectly-fine-password",
    })
    expect(result.ok).toBe(false)
  })
})

describe("issueInvitation parameters", () => {
  it("accepts a null creator, for an invitation nobody issued by hand", async () => {
    const user = await makeUser("null-creator")
    await issueInvitation(prisma, { userId: user.id, createdByUserId: null })

    const row = await prisma.userInvitation.findFirst({ where: { userId: user.id } })
    expect(row?.createdByUserId).toBeNull()
  })

  it("stores the hash of a supplied token instead of generating one", async () => {
    const user = await makeUser("supplied-token")
    const supplied = `supplied-${ctx.suffix}-${"x".repeat(32)}`

    const { token } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: null,
      token: supplied,
    })

    expect(token).toBe(supplied)
    const row = await prisma.userInvitation.findFirst({ where: { userId: user.id } })
    expect(row?.tokenHash).toBe(hashToken(supplied))
  })

  it("honours a shorter ttl than the default", async () => {
    const user = await makeUser("short-ttl")
    const now = new Date()

    const { expiresAt } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: null,
      now,
      ttlHours: 24,
    })

    expect(expiresAt.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000)
  })

  it("still defaults to the standard ttl when none is given", async () => {
    const user = await makeUser("default-ttl")
    const now = new Date()

    const { expiresAt } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: null,
      now,
    })

    expect(expiresAt.getTime()).toBe(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000)
  })
})
