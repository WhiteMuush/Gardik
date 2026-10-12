import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"

vi.mock("./normalize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./normalize")>()),
  sleep: () => Promise.resolve(),
}))

import { prisma } from "@/lib/prisma"
import { runScan, type ActiveProvider } from "./runner"
import { getScanCoverage } from "./coverage"
import { ProviderError } from "./errors"

let companyId: string
const lookups: Record<string, string[]> = { HIBP: [], LEAKCHECK: [] }

function source(id: "HIBP" | "LEAKCHECK", fail: boolean): ActiveProvider {
  return {
    key: "k",
    ratePerMinute: 60_000,
    provider: {
      id,
      source: id === "HIBP" ? "HIBP" : "DARK_WEB",
      defaultRatePerMinute: 60_000,
      async lookup(email) {
        lookups[id].push(email)
        if (fail) throw new ProviderError(`${id} error 401`, 401)
        return []
      },
    },
  }
}

beforeAll(async () => {
  const c = await prisma.company.create({
    data: { name: "Scan Coverage Co", domain: `scan-${Date.now()}.test` },
  })
  companyId = c.id
  await prisma.employee.createMany({
    data: [1, 2, 3].map((n) => ({ email: `e${n}@scan.test`, firstName: "E", lastName: `${n}`, companyId })),
  })
  await prisma.apiCredential.createMany({
    data: (["HIBP", "LEAKCHECK"] as const).map((provider) => ({
      companyId,
      provider,
      label: provider,
      encryptedKey: "unused",
      keyHint: "****",
      status: "ACTIVE" as const,
    })),
  })
})

// Employees, checks and credentials all cascade from the company.
afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe("scan coverage (real DB)", () => {
  it("reports what each source checked and why the rest failed", async () => {
    const res = await runScan(companyId, [source("HIBP", false), source("LEAKCHECK", true)])

    expect(res).toMatchObject({ scanned: 3, failedChecks: 3 })
    expect(lookups.LEAKCHECK).toHaveLength(1)
    expect(await getScanCoverage(companyId)).toEqual([
      expect.objectContaining({ provider: "HIBP", checked: 3, failed: 0, neverChecked: 0 }),
      expect.objectContaining({
        provider: "LEAKCHECK",
        checked: 0,
        failed: 3,
        neverChecked: 0,
        lastFailureReason: "API key rejected",
      }),
    ])
  })

  it("retries only the pairs that are not checked yet", async () => {
    lookups.HIBP = []
    lookups.LEAKCHECK = []

    const res = await runScan(companyId, [source("HIBP", false), source("LEAKCHECK", false)], {
      onlyIncomplete: true,
    })

    expect(res).toMatchObject({ scanned: 3, failedChecks: 0 })
    expect(lookups.HIBP).toEqual([])
    expect(lookups.LEAKCHECK).toHaveLength(3)
    const leakcheck = (await getScanCoverage(companyId)).find((c) => c.provider === "LEAKCHECK")
    expect(leakcheck).toMatchObject({ checked: 3, failed: 0, lastFailureReason: null })
  })
})
