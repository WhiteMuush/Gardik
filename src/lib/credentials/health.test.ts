import { describe, it, expect } from "vitest"
import { sourceHealth } from "./health"
import type { SourceCoverage } from "@/lib/scan/coverage"

const failedAt = new Date("2026-10-12T10:00:00Z")

function coverage(over: Partial<SourceCoverage> = {}): SourceCoverage {
  return {
    provider: "HIBP",
    label: "Have I Been Pwned",
    checked: 5,
    failed: 0,
    neverChecked: 0,
    lastFailureReason: null,
    lastFailureAt: null,
    ...over,
  }
}

describe("sourceHealth", () => {
  it("is not connected without a key", () => {
    expect(sourceHealth(null, null)).toEqual({ status: "NOT_CONNECTED", label: "Not connected", detail: null })
  })

  it("is not scanned yet when a key exists but nothing was checked", () => {
    const cred = { updatedAt: failedAt }
    expect(sourceHealth(cred, null).status).toBe("NOT_SCANNED")
    expect(sourceHealth(cred, coverage({ checked: 0, neverChecked: 5 })).status).toBe("NOT_SCANNED")
  })

  it("needs action when the last scan failed, and says why", () => {
    const cred = { updatedAt: new Date("2026-10-11T10:00:00Z") }
    const health = sourceHealth(
      cred,
      coverage({ checked: 0, failed: 5, lastFailureReason: "API key rejected", lastFailureAt: failedAt })
    )
    expect(health).toEqual({ status: "NEEDS_ACTION", label: "API key rejected", detail: "API key rejected" })
  })

  it("waits for a scan when the key or rate changed after the failure", () => {
    const cred = { updatedAt: new Date("2026-10-12T11:00:00Z") }
    const health = sourceHealth(
      cred,
      coverage({ checked: 0, failed: 5, lastFailureReason: "API key rejected", lastFailureAt: failedAt })
    )
    expect(health.status).toBe("NOT_SCANNED")
    expect(health.label).toBe("Changed since last scan")
  })

  it("is connected when the last checks succeeded", () => {
    expect(sourceHealth({ updatedAt: failedAt }, coverage()).status).toBe("CONNECTED")
  })
})
