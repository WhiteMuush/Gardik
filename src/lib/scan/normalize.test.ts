import { describe, it, expect, vi } from "vitest"
import { normalizeType, parseBreachDate, sleep } from "./normalize"

describe("normalizeType", () => {
  it("lowercases, trims, and snake_cases whitespace runs", () => {
    expect(normalizeType("  Hashed Password ")).toBe("hashed_password")
    expect(normalizeType("Credit   Card")).toBe("credit_card")
    expect(normalizeType("EMAIL")).toBe("email")
  })
})

describe("parseBreachDate", () => {
  it("returns epoch for missing input", () => {
    expect(parseBreachDate().getTime()).toBe(0)
    expect(parseBreachDate(null).getTime()).toBe(0)
    expect(parseBreachDate("").getTime()).toBe(0)
  })

  it("returns epoch for an unparseable date", () => {
    expect(parseBreachDate("not-a-date").getTime()).toBe(0)
  })

  it("parses a valid ISO date", () => {
    expect(parseBreachDate("2021-03-15").toISOString()).toBe("2021-03-15T00:00:00.000Z")
  })
})

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    vi.useFakeTimers()
    let done = false
    const p = sleep(1000).then(() => {
      done = true
    })
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    await p
    expect(done).toBe(true)
    vi.useRealTimers()
  })
})
