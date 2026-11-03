import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { APIError } from "better-auth/api"

import { prisma } from "@/lib/prisma"
import { AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { recordTwoFactorToggle, recordPasskeyEvent } from "./account-audit"

const suffix = `account-audit-${Date.now()}`
let companyId = ""
let userId = ""

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: "Account Audit Co", domain: `${suffix}.test` },
  })
  companyId = company.id
  const user = await prisma.user.create({ data: { email: `${suffix}@test.local`, companyId } })
  userId = user.id
})

afterAll(async () => {
  await prisma.company.delete({ where: { id: companyId } })
})

function rows(action: string) {
  return prisma.auditLog.findMany({ where: { companyId, action } })
}

const session = () => ({ user: { id: userId, companyId }, session: { ipAddress: "192.0.2.50" } })

describe("recordTwoFactorToggle", () => {
  it("records an enrollment and a removal from the two-factor endpoints", async () => {
    await recordTwoFactorToggle(
      prisma,
      { id: userId, companyId, twoFactorEnabled: true },
      "/two-factor/verify-totp",
      null
    )
    await recordTwoFactorToggle(
      prisma,
      { id: userId, companyId, twoFactorEnabled: false },
      "/two-factor/disable",
      "192.0.2.50"
    )

    const enabled = await rows(AUDIT_ACTIONS.USER_2FA_ENABLE)
    const disabled = await rows(AUDIT_ACTIONS.USER_2FA_DISABLE)
    expect(enabled).toHaveLength(1)
    expect(enabled[0]!.targetId).toBe(userId)
    expect(disabled).toHaveLength(1)
    expect(disabled[0]!.ip).toBe("192.0.2.50")
  })

  it("ignores user updates made anywhere else", async () => {
    const before = await prisma.auditLog.count({ where: { companyId } })
    await recordTwoFactorToggle(
      prisma,
      { id: userId, companyId, twoFactorEnabled: true },
      "/update-user",
      null
    )
    await recordTwoFactorToggle(prisma, { id: userId, companyId, twoFactorEnabled: true }, undefined, null)
    expect(await prisma.auditLog.count({ where: { companyId } })).toBe(before)
  })
})

describe("recordPasskeyEvent", () => {
  it("records a registered passkey by its id", async () => {
    await recordPasskeyEvent(prisma, {
      path: "/passkey/verify-registration",
      body: {},
      returned: { id: "pk-added", name: "Laptop" },
      session: session(),
    })
    const added = await rows(AUDIT_ACTIONS.USER_PASSKEY_ADD)
    expect(added).toHaveLength(1)
    expect(added[0]!.targetType).toBe("Passkey")
    expect(added[0]!.targetId).toBe("pk-added")
    expect(added[0]!.ip).toBe("192.0.2.50")
  })

  it("records a deleted passkey from the request body", async () => {
    await recordPasskeyEvent(prisma, {
      path: "/passkey/delete-passkey",
      body: { id: "pk-removed" },
      returned: { status: true },
      session: session(),
    })
    const removed = await rows(AUDIT_ACTIONS.USER_PASSKEY_REMOVE)
    expect(removed).toHaveLength(1)
    expect(removed[0]!.targetId).toBe("pk-removed")
  })

  it("records nothing for a failed call, another path or a missing session", async () => {
    const before = await prisma.auditLog.count({ where: { companyId } })
    const failed = new APIError("UNAUTHORIZED", { message: "nope" })
    await recordPasskeyEvent(prisma, {
      path: "/passkey/delete-passkey",
      body: { id: "x" },
      returned: failed,
      session: session(),
    })
    await recordPasskeyEvent(prisma, {
      path: "/passkey/list-user-passkeys",
      body: {},
      returned: [],
      session: session(),
    })
    await recordPasskeyEvent(prisma, {
      path: "/passkey/verify-registration",
      body: {},
      returned: { id: "y" },
      session: null,
    })
    expect(await prisma.auditLog.count({ where: { companyId } })).toBe(before)
  })
})
