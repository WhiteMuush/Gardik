import { describe, it, expect } from "vitest"
import { parseRateLimit } from "./service"

describe("parseRateLimit", () => {
  it("accepts a positive whole number of requests per minute", () => {
    expect(parseRateLimit(10)).toEqual({ ok: true, value: 10 })
    expect(parseRateLimit(100_000)).toEqual({ ok: true, value: 100_000 })
  })
  it("treats null as going back to the provider default", () => {
    expect(parseRateLimit(null)).toEqual({ ok: true, value: null })
  })
  it("rejects anything else", () => {
    for (const bad of [0, -5, 1.5, 100_001, "10", undefined, NaN]) {
      expect(parseRateLimit(bad)).toEqual({ ok: false })
    }
  })
})
