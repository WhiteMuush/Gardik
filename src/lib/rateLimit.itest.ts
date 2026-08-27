import { afterAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { rateLimit, pruneRateLimits } from "./rateLimit"
import { checkScimRateLimit } from "./directory/scim-auth"

// Integration, not unit: the counter lives in Postgres now, which is the whole
// point. A mocked store would only prove the mock counts.

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
    // Long enough that the two calls below land inside the same window; a 1ms
    // window expires between them and the refusal never happens.
    expect(await rateLimit(key, 1, 150)).toBe(true)
    expect(await rateLimit(key, 1, 150)).toBe(false)
    await new Promise((r) => setTimeout(r, 200))
    expect(await rateLimit(key, 1, 60_000)).toBe(true)
  })

  // The reason the counter moved to SQL: two requests landing together must not
  // both read a stale count and both conclude they are under the limit.
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

// The bug this guards: "reset" is a `timestamp without time zone` holding UTC
// digits, and comparing it against a bare `now()` coerced it to the session
// timezone. On a session ahead of UTC every window read as already expired, so
// the counter reset on each call and the limiter refused nothing. CI runs its
// database in UTC, where the offset is zero and the fault is invisible, so
// these two pin the timezone themselves rather than trusting the environment.
//
// set_config(..., true) is SET LOCAL with a bind parameter: it holds for the
// current transaction only, and only on the connection that transaction owns.
// That is why the limiter takes a client here instead of reaching for the
// pooled singleton.
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

  // The other direction locks people out rather than letting them through: a
  // session behind UTC pushes every "reset" into the future, so a window that
  // has long passed never rolls over. Seeded as an already-expired row instead
  // of by waiting, because now() is the transaction start time and does not
  // advance inside the transaction that pins the timezone.
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
