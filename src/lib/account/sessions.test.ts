import { describe, it, expect, vi } from "vitest"
import { listAccountSessions } from "./sessions"

const NOW = new Date("2026-10-29T10:00:00Z")

function fakeDb(rows: Record<string, unknown>[]) {
  const findMany = vi.fn(async () => rows)
  return { db: { session: { findMany } } as never, findMany }
}

describe("listAccountSessions", () => {
  it("asks only for the caller's live sessions, most recent first", async () => {
    const { db, findMany } = fakeDb([])
    await listAccountSessions(db, "user-1", "tok-a", NOW)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", expiresAt: { gt: NOW } },
        orderBy: { updatedAt: "desc" },
      })
    )
  })

  it("marks the current session and never returns a token", async () => {
    const { db } = fakeDb([
      {
        id: "s1",
        token: "tok-a",
        userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
        ipAddress: "203.0.113.1",
        createdAt: NOW,
        updatedAt: NOW,
      },
      { id: "s2", token: "tok-b", userAgent: null, ipAddress: null, createdAt: NOW, updatedAt: NOW },
    ])

    const sessions = await listAccountSessions(db, "user-1", "tok-a", NOW)

    expect(sessions).toEqual([
      {
        id: "s1",
        device: "Firefox on Linux",
        ipAddress: "203.0.113.1",
        createdAt: NOW,
        updatedAt: NOW,
        current: true,
      },
      { id: "s2", device: "Unknown device", ipAddress: null, createdAt: NOW, updatedAt: NOW, current: false },
    ])
    expect(JSON.stringify(sessions)).not.toContain("tok-")
  })
})
