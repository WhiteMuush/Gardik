import { afterAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { rateLimit, pruneRateLimits } from "./rateLimit"
import { checkScimRateLimit } from "./directory/scim-auth"

// Integration, since the counter lives in Postgres and a mocked store would only prove the mock counts.

const keys: string[] = []
function freshKey(prefix: string): string {
  const k = `${prefix}-${Math.random().toString(36).slice(2)}`
  keys.push(k)
  return k
}

afterAll(async () => {
  await prisma.apiRateLimit.deleteMany({ where: { key: { in: keys } } })
})

describe("rateLimit", () => {
  it("allows up to the limit then refuses", async () => {
    const key = freshKey("unit")
    for (let i = 0; i < 3; i++) expect(await rateLimit(key, 3, 60_000)).toBe(true)
    expect(await rateLimit(key, 3, 60_000)).toBe(false)
    expect(await rateLimit(key, 3, 60_000)).toBe(false)
  })

  it("counts each key on its own", async () => {
    const a = freshKey("a")
    const b = freshKey("b")
    for (let i = 0; i < 3; i++) await rateLimit(a, 3, 60_000)
    expect(await rateLimit(a, 3, 60_000)).toBe(false)
    expect(await rateLimit(b, 3, 60_000)).toBe(true)
  })

  it("starts a new window once the old one has expired", async () => {
    const key = freshKey("window")
    // Long enough for both calls to land in one window.
    expect(await rateLimit(key, 1, 150)).toBe(true)
    expect(await rateLimit(key, 1, 150)).toBe(false)
    await new Promise((r) => setTimeout(r, 200))
    expect(await rateLimit(key, 1, 60_000)).toBe(true)
  })

  // Two simultaneous requests must not both read a stale count and pass.
  it("does not overshoot under concurrency", async () => {
    const key = freshKey("race")
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(key, 5, 60_000)))
    expect(results.filter(Boolean)).toHaveLength(5)
  })

  it("survives a process restart, because the count is not in memory", async () => {
    const key = freshKey("persist")
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60_000)
    const row = await prisma.apiRateLimit.findUnique({ where: { key } })
    expect(row?.count).toBe(3)
  })
})

// Pins a non-UTC timezone with SET LOCAL, since CI runs in UTC where the reset comparison bug is invisible.
describe("rateLimit under a non-UTC session", () => {
  it("still refuses past the limit on a session ahead of UTC", async () => {
    const key = freshKey("tz-ahead")
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('TimeZone', ${"Pacific/Kiritimati"}, true)` // UTC+14
      expect(await rateLimit(key, 2, 60_000, tx)).toBe(true)
      expect(await rateLimit(key, 2, 60_000, tx)).toBe(true)
      expect(await rateLimit(key, 2, 60_000, tx)).toBe(false)
    })
  })

  // Seeded as an expired row, since now() does not advance inside the transaction pinning the timezone.
  it("still rolls an expired window over on a session behind UTC", async () => {
    const key = freshKey("tz-behind")
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000)
    await prisma.apiRateLimit.create({ data: { key, count: 99, reset: fiveMinutesAgo } })

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('TimeZone', ${"Pacific/Niue"}, true)` // UTC-11
      expect(await rateLimit(key, 1, 60_000, tx)).toBe(true)
    })

    expect((await prisma.apiRateLimit.findUnique({ where: { key } }))?.count).toBe(1)
  })
})

describe("pruneRateLimits", () => {
  it("drops rows whose window has passed and keeps live ones", async () => {
    const stale = freshKey("stale")
    const live = freshKey("live")
    await rateLimit(stale, 5, 50)
    await rateLimit(live, 5, 60_000)
    await new Promise((r) => setTimeout(r, 120))

    await pruneRateLimits()

    expect(await prisma.apiRateLimit.findUnique({ where: { key: stale } })).toBeNull()
    expect(await prisma.apiRateLimit.findUnique({ where: { key: live } })).not.toBeNull()
  })
})

describe("checkScimRateLimit", () => {
  it("allows 120 requests per connection then throttles", async () => {
    const id = freshKey("conn")
    keys.push(`scim:${id}`)
    for (let i = 0; i < 120; i++) expect(await checkScimRateLimit(id)).toBe(true)
    expect(await checkScimRateLimit(id)).toBe(false)
  })
})
