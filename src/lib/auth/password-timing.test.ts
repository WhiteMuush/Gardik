import { describe, it, expect } from "vitest"
import bcrypt from "bcryptjs"
import { burnPasswordTime, notFasterThan, MIN_VERIFY_MS } from "./password-timing"

describe("burnPasswordTime", () => {
  it("always fails", async () => {
    expect(await burnPasswordTime("anything")).toBe(false)
  })

  // A fast return would let the clock tell "no account" from "wrong password".
  it("costs what a real comparison costs", async () => {
    const hash = await bcrypt.hash("a-real-password", 12)

    const realStart = Date.now()
    await bcrypt.compare("wrong-password", hash)
    const real = Date.now() - realStart

    const burnStart = Date.now()
    await burnPasswordTime("wrong-password")
    const burn = Date.now() - burnStart

    // Same order of magnitude only, since CI machines are noisy.
    expect(burn).toBeGreaterThan(real / 4)
    expect(burn).toBeLessThan(real * 4)
  })
})

describe("notFasterThan", () => {
  it("holds a fast result back to the floor", async () => {
    const started = Date.now()
    const result = await notFasterThan(120, Promise.resolve("done"))
    expect(result).toBe("done")
    expect(Date.now() - started).toBeGreaterThanOrEqual(115)
  })

  it("does not delay work that already took longer", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("slow"), 60))
    const started = Date.now()
    await notFasterThan(20, slow)
    expect(Date.now() - started).toBeLessThan(200)
  })

  it("passes the value through untouched", async () => {
    expect(await notFasterThan(1, Promise.resolve({ ok: true }))).toEqual({ ok: true })
  })

  it("keeps a floor long enough to matter against online guessing", () => {
    expect(MIN_VERIFY_MS).toBeGreaterThanOrEqual(250)
  })
})
