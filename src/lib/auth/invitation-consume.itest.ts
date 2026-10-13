import { describe, it, expect } from "vitest"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { issueInvitation, consumeInvitation, INVITATION_TTL_HOURS } from "./invitation"
import { invitationFixture } from "./invitation.fixtures"

// Redeeming invitations: single use under concurrency, expiry, weak passwords and session revocation.
const { ctx, makeUser } = invitationFixture("consume")

describe("consumeInvitation", () => {
  it("sets the password, verifies the address, and lets the user sign in", async () => {
    const user = await makeUser("happy-path")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    const result = await consumeInvitation(prisma, { token, password: "chosen-by-the-user-1" })
    expect(result.ok).toBe(true)

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, providerId: "credential" },
    })
    expect(await bcrypt.compare("chosen-by-the-user-1", account.password!)).toBe(true)

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.emailVerified).toBe(true)
    expect(after.mustChangePassword).toBe(false)
  })

  it("refuses a second use of the same link", async () => {
    const user = await makeUser("single-use")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    expect((await consumeInvitation(prisma, { token, password: "first-use-password-1" })).ok).toBe(true)
    const second = await consumeInvitation(prisma, { token, password: "second-use-password-1" })
    expect(second.ok).toBe(false)

    // The first password stands: a replay must not overwrite it.
    const account = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, providerId: "credential" },
    })
    expect(await bcrypt.compare("first-use-password-1", account.password!)).toBe(true)
  })

  // The interesting failure: two requests arriving together, both reading the
  // row as unconsumed before either writes. The claim is a conditional update
  // rather than a read followed by a write, so exactly one can win.
  it("refuses a second use even when both requests arrive at once", async () => {
    const user = await makeUser("race")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    const results = await Promise.all([
      consumeInvitation(prisma, { token, password: "racing-password-aaa1" }),
      consumeInvitation(prisma, { token, password: "racing-password-bbb2" }),
    ])

    expect(results.filter((r) => r.ok)).toHaveLength(1)
  })

  it("refuses an expired link", async () => {
    const user = await makeUser("expired")
    const past = new Date(Date.now() - (INVITATION_TTL_HOURS + 1) * 60 * 60 * 1000)
    const { token } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: ctx.inviterId,
      now: past,
    })

    expect((await consumeInvitation(prisma, { token, password: "too-late-password-1" })).ok).toBe(false)
  })

  it("refuses a token nobody ever issued, with the same message as a spent one", async () => {
    const user = await makeUser("unknown")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })
    await consumeInvitation(prisma, { token, password: "spend-it-now-password1" })

    const spent = await consumeInvitation(prisma, { token, password: "another-password-here1" })
    const madeUp = await consumeInvitation(prisma, {
      token: "not-a-real-token-at-all",
      password: "another-password-here1",
    })

    expect(spent.ok).toBe(false)
    expect(madeUp.ok).toBe(false)
    if (!spent.ok && !madeUp.ok) expect(madeUp.message).toBe(spent.message)
  })

  it("rejects a weak password without spending the link", async () => {
    const user = await makeUser("weak")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    const weak = await consumeInvitation(prisma, { token, password: "short" })
    expect(weak.ok).toBe(false)

    // Still usable: a typo must not cost the invitee their only link.
    expect((await consumeInvitation(prisma, { token, password: "a-proper-password-01" })).ok).toBe(true)
  })

  // An invitation is also the recovery path for an account believed
  // compromised, so redeeming one has to end whatever sessions already exist.
  it("drops every existing session of the invited user", async () => {
    const user = await makeUser("sessions", { withPassword: true })
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `invite-itest-session-${ctx.suffix}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: ctx.inviterId })

    expect((await consumeInvitation(prisma, { token, password: "rotated-password-001" })).ok).toBe(true)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })
})
