import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { summarizeCoverage, checkLabel, coverageSignature } from "./coverage"

describe("summarizeCoverage", () => {
  it("counts checked, failed and never checked employees per active source", () => {
    const res = summarizeCoverage(
      10,
      ["HIBP", "LEAKCHECK"],
      [
        { provider: "HIBP", status: "CHECKED", count: 7 },
        { provider: "HIBP", status: "FAILED", count: 2 },
        { provider: "LEAKCHECK", status: "CHECKED", count: 10 },
      ],
      { HIBP: { reason: "Rate limited by the source", at: new Date("2026-10-12T10:00:00Z") } }
    )
    expect(res).toEqual([
      {
        provider: "HIBP",
        label: "Have I Been Pwned",
        checked: 7,
        failed: 2,
        neverChecked: 1,
        lastFailureReason: "Rate limited by the source",
        lastFailureAt: new Date("2026-10-12T10:00:00Z"),
      },
      {
        provider: "LEAKCHECK",
        label: "LeakCheck",
        checked: 10,
        failed: 0,
        neverChecked: 0,
        lastFailureReason: null,
        lastFailureAt: null,
      },
    ])
  })

  it("ignores checks left over from a source that is no longer configured", () => {
    const res = summarizeCoverage(3, ["HIBP"], [{ provider: "DEHASHED", status: "FAILED", count: 3 }], {})
    expect(res).toEqual([
      expect.objectContaining({ provider: "HIBP", checked: 0, failed: 0, neverChecked: 3 }),
    ])
  })
})

describe("checkLabel", () => {
  const at = new Date("2026-10-12T10:00:00Z")

  it("says when a source last checked the employee", () => {
    expect(checkLabel({ status: "CHECKED", failureReason: null, lastAttemptAt: at, lastCheckedAt: at })).toBe(
      "Checked on Oct 12, 2026"
    )
  })
  it("says why the last check failed, and when it last succeeded", () => {
    const earlier = new Date("2026-10-01T10:00:00Z")
    expect(
      checkLabel({
        status: "FAILED",
        failureReason: "API key rejected",
        lastAttemptAt: at,
        lastCheckedAt: earlier,
      })
    ).toBe("Failed on Oct 12, 2026: API key rejected. Last checked on Oct 1, 2026")
    expect(
      checkLabel({
        status: "FAILED",
        failureReason: "API key rejected",
        lastAttemptAt: at,
        lastCheckedAt: null,
      })
    ).toBe("Failed on Oct 12, 2026: API key rejected. Never checked")
  })
  it("says never checked when there is no check yet", () => {
    expect(checkLabel(null)).toBe("Never checked")
  })
})

describe("coverageSignature", () => {
  const base = summarizeCoverage(5, ["HIBP"], [{ provider: "HIBP", status: "FAILED", count: 5 }], {
    HIBP: { reason: "API key rejected", at: new Date("2026-10-12T10:00:00Z") },
  })

  it("is stable while the scan status does not change", () => {
    expect(coverageSignature(base)).toBe(coverageSignature(structuredClone(base)))
  })

  it("changes when the counts or the last error change", () => {
    const fewer = base.map((c) => ({ ...c, failed: 3, checked: 2 }))
    const other = base.map((c) => ({ ...c, lastFailureReason: "Rate limited by the source" }))
    expect(coverageSignature(fewer)).not.toBe(coverageSignature(base))
    expect(coverageSignature(other)).not.toBe(coverageSignature(base))
  })
})
