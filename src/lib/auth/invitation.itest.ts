import { describe, it, expect, beforeAll, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { issueInvitation, consumeInvitation, hashToken, INVITATION_TTL_HOURS } from "./invitation"

// The security properties of the invitation flow, against a real database:
// single use under concurrency, expiry, session revocation, and the fact that
// nothing replayable is stored.

const suffix = Date.now()
let companyId = ""
let inviterId = ""

async function makeUser(label: string, opts: { withPassword?: boolean } = {}) {
  const user = await prisma.user.create({
    data: {
      email: `invite-${label}-${suffix}@test.local`,
      companyId,
      emailVerified: false,
    },
  })
  if (opts.withPassword) {
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await bcrypt.hash("old-password-that-works", 12),
      },
    })
  }
  return user
}

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: "Invitation Co", domain: `invitation-${suffix}.test` },
  })
  companyId = company.id
  const inviter = await prisma.user.create({
    data: { email: `invite-actor-${suffix}@test.local`, companyId, emailVerified: true },
  })
  inviterId = inviter.id
})

afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe("issueInvitation", () => {
  it("stores only a hash, never anything that can be replayed", async () => {
    const user = await makeUser("stores-hash")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

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
      createdByUserId: inviterId,
      now,
    })
    expect(expiresAt.getTime() - now.getTime()).toBe(INVITATION_TTL_HOURS * 60 * 60 * 1000)
  })

  // Re-inviting after a suspected leak has to retire the leaked link, or the
  // resend hands the attacker a second chance rather than closing the first.
  it("voids the previous link when a new one is issued", async () => {
    const user = await makeUser("supersede")
    const first = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })
    await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

    const result = await consumeInvitation(prisma, {
      token: first.token,
      password: "a-perfectly-fine-password",
    })
    expect(result.ok).toBe(false)
  })
})

describe("consumeInvitation", () => {
  it("sets the password, verifies the address, and lets the user sign in", async () => {
    const user = await makeUser("happy-path")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

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
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

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
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

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
      createdByUserId: inviterId,
      now: past,
    })

    expect((await consumeInvitation(prisma, { token, password: "too-late-password-1" })).ok).toBe(false)
  })

  it("refuses a token nobody ever issued, with the same message as a spent one", async () => {
    const user = await makeUser("unknown")
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })
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
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

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
        token: `invite-itest-session-${suffix}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    const { token } = await issueInvitation(prisma, { userId: user.id, createdByUserId: inviterId })

    expect((await consumeInvitation(prisma, { token, password: "rotated-password-001" })).ok).toBe(true)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })
})
