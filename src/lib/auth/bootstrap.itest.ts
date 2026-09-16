import { describe, it, expect } from "vitest"
import type { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { CREDENTIAL_ISSUER } from "@/lib/auth/account"
import { hashToken } from "./invitation"
import {
  bootstrapState,
  createFirstAdmin,
  BOOTSTRAP_INVITATION_TTL_HOURS,
  MIN_BOOTSTRAP_TOKEN_LENGTH,
} from "./bootstrap"

// The gate only has meaning against an empty database, and the development
// database is never empty. Each test therefore runs inside a transaction that
// first clears every company (users, accounts and invitations cascade from it)
// and is always rolled back, so nothing the suite does survives it.
const ROLLBACK = Symbol("rollback")

async function onEmptyDb<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let captured: T
  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.deleteMany({})
      captured = await fn(tx)
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  return captured!
}

const config = {
  email: "admin@bootstrap.test",
  domain: "bootstrap.test",
  token: `bootstrap-${"z".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)}`,
}

describe("bootstrapState", () => {
  it("is fresh when the database holds nothing", async () => {
    const state = await onEmptyDb((tx) => bootstrapState(tx, config.email))
    expect(state).toBe("fresh")
  })

  it("is resumable when the administrator exists with no password", async () => {
    const state = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      return bootstrapState(tx, config.email)
    })
    expect(state).toBe("resumable")
  })

  it("is closed as soon as any account carries a password", async () => {
    const state = await onEmptyDb(async (tx) => {
      const company = await tx.company.create({
        data: { name: "Other", domain: "other.test" },
      })
      const user = await tx.user.create({
        data: { email: "someone@other.test", companyId: company.id },
      })
      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          issuer: CREDENTIAL_ISSUER,
          userId: user.id,
          password: await bcrypt.hash("a-password-that-works", 12),
        },
      })
      return bootstrapState(tx, config.email)
    })
    expect(state).toBe("closed")
  })
})

describe("createFirstAdmin", () => {
  it("creates the company, the administrator and the invitation", async () => {
    const result = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const company = await tx.company.findUnique({ where: { domain: config.domain } })
      const user = await tx.user.findUnique({ where: { email: config.email } })
      const role = user?.roleId ? await tx.role.findUnique({ where: { id: user.roleId } }) : null
      const invitation = await tx.userInvitation.findFirst({ where: { userId: user!.id } })
      return { company, user, role, invitation }
    })

    expect(result.company?.name).toBe(config.domain)
    expect(result.user?.companyId).toBe(result.company?.id)
    expect(result.role?.name).toBe("Administrator")
    expect(result.invitation?.tokenHash).toBe(hashToken(config.token))
    expect(result.invitation?.createdByUserId).toBeNull()
  })

  it("leaves the administrator without any credential account", async () => {
    const accounts = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })
      return tx.account.findMany({ where: { userId: user!.id } })
    })
    expect(accounts).toHaveLength(0)
  })

  it("expires the invitation after the bootstrap window, not the default one", async () => {
    const invitation = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })
      return tx.userInvitation.findFirst({ where: { userId: user!.id } })
    })

    const hours = (invitation!.expiresAt.getTime() - invitation!.createdAt.getTime()) / 3_600_000
    expect(Math.round(hours)).toBe(BOOTSTRAP_INVITATION_TTL_HOURS)
  })

  it("run twice, produces one company, one user and one live invitation", async () => {
    const counts = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })
      return {
        companies: await tx.company.count(),
        users: await tx.user.count(),
        live: await tx.userInvitation.count({ where: { userId: user!.id, consumedAt: null } }),
      }
    })

    expect(counts.companies).toBe(1)
    expect(counts.users).toBe(1)
    expect(counts.live).toBe(1)
  })

  it("refreshes an expired invitation when the same token is reused", async () => {
    const rows = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })

      // Backdate it past its window: the state a restart finds after a day of
      // nobody opening the link.
      await tx.userInvitation.updateMany({
        where: { userId: user!.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })

      await createFirstAdmin(tx, config)
      return tx.userInvitation.findMany({ where: { userId: user!.id } })
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].consumedAt).toBeNull()
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("writes the creation and the invitation to the audit trail, with no actor", async () => {
    const entries = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      return tx.auditLog.findMany({ orderBy: { action: "asc" } })
    })

    expect(entries.map((e) => e.action)).toEqual(["user.create", "user.invite"])
    expect(entries.every((e) => e.actorUserId === null)).toBe(true)
  })
})
