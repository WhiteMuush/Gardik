import { describe, it, expect, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import type { BootstrapState, BootstrapClient } from "./bootstrap"
import { bootstrapFirstAdmin } from "./bootstrap"
import { ROLLBACK, config } from "./bootstrap.fixtures"

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
    // The seeded development admin is exactly the closed state of a running instance.
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
        // Prisma's unique-constraint error from a losing replica; only the log tells this branch from the generic one.
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
    // Captured, not asserted inside, because bootstrapFirstAdmin swallows every exception and would hide a failure.
    let stateInside: BootstrapState | null = null

    const observed: BootstrapClient = {
      $transaction: async (fn) => {
        transactions += 1
        return prisma.$transaction(async (tx) => {
          await tx.company.deleteMany({})
          stateInside = await fn(tx)
          // Rolls back the company, role presets, user, invitation and both audit rows.
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
