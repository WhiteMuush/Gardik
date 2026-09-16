import { describe, it, expect, vi } from "vitest"
import type { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { CREDENTIAL_ISSUER } from "@/lib/auth/account"
import { hashToken } from "./invitation"
import type { BootstrapState, BootstrapClient } from "./bootstrap"
import {
  bootstrapState,
  createFirstAdmin,
  bootstrapFirstAdmin,
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

  it("audits a second run as an invitation only, never as another creation", async () => {
    const actions = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      await createFirstAdmin(tx, config)
      const rows = await tx.auditLog.findMany({ orderBy: { createdAt: "asc" } })
      return rows.map((row) => row.action)
    })

    expect(actions.filter((a) => a === "user.create")).toHaveLength(1)
    expect(actions.filter((a) => a === "user.invite")).toHaveLength(2)
  })
})

describe("bootstrapFirstAdmin", () => {
  const env = {
    BOOTSTRAP_ADMIN_EMAIL: config.email,
    BOOTSTRAP_INVITE_TOKEN: config.token,
  }

  it("does nothing and says nothing when unconfigured", async () => {
    const before = await prisma.company.count()
    await bootstrapFirstAdmin(prisma, {})
    expect(await prisma.company.count()).toBe(before)
  })

  it("does nothing when an account already carries a password", async () => {
    // The development database is seeded with a working admin, which is exactly
    // the closed state a running instance is in.
    const before = await prisma.company.count()
    await bootstrapFirstAdmin(prisma, env)
    expect(await prisma.company.count()).toBe(before)
    expect(await prisma.user.findUnique({ where: { email: config.email } })).toBeNull()
  })

  it("never throws when the database is unreachable", async () => {
    const broken: BootstrapClient = {
      $transaction: async () => {
        throw new Error("connection refused")
      },
    }

    await expect(bootstrapFirstAdmin(broken, env)).resolves.toBeUndefined()
  })

  it("treats a lost race between replicas as a no-op, not a failure", async () => {
    const raced: BootstrapClient = {
      $transaction: async () => {
        // The shape Prisma raises when a second replica loses on a unique
        // constraint. Asserting on the log is the only way to tell this branch
        // from the generic one: both end in the same silent resolve.
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      },
    }

    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      await expect(bootstrapFirstAdmin(raced, env)).resolves.toBeUndefined()
      expect(info).toHaveBeenCalledWith(expect.stringContaining("Another replica"))
      expect(warn).not.toHaveBeenCalled()
    } finally {
      info.mockRestore()
      warn.mockRestore()
    }
  })

  it("never throws on a malformed address", async () => {
    await expect(
      bootstrapFirstAdmin(prisma, { ...env, BOOTSTRAP_ADMIN_EMAIL: "not-an-address" })
    ).resolves.toBeUndefined()
  })

  it("routes every write through one transaction, so a rollback leaves nothing", async () => {
    let transactions = 0
    // Captured rather than asserted in place: bootstrapFirstAdmin swallows every
    // exception by contract, so an assertion thrown inside the callback would be
    // caught and logged, and the test would pass while proving nothing.
    let stateInside: BootstrapState | null = null

    const observed: BootstrapClient = {
      $transaction: async (fn) => {
        transactions += 1
        return prisma.$transaction(async (tx) => {
          await tx.company.deleteMany({})
          stateInside = await fn(tx)
          // Roll the whole thing back, including the company, the role presets,
          // the user, the invitation and both audit rows.
          throw ROLLBACK
        })
      },
    }

    // The orchestrator swallows the rollback and logs it, which is the contract.
    await expect(bootstrapFirstAdmin(observed, env)).resolves.toBeUndefined()

    expect(transactions).toBe(1)
    expect(stateInside).toBe("fresh")
    expect(await prisma.company.findUnique({ where: { domain: config.domain } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { email: config.email } })).toBeNull()
  })
})
