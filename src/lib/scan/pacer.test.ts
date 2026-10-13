import { describe, it, expect, vi, beforeEach } from "vitest"

const waits: number[] = []
vi.mock("./normalize", () => ({
  sleep: (ms: number) => {
    waits.push(ms)
    return Promise.resolve()
  },
}))

import { createPacer } from "./pacer"

describe("createPacer", () => {
  beforeEach(() => {
    waits.length = 0
  })

  it("lets the first call through and spaces the next ones by the rate", async () => {
    const pace = createPacer(10, () => 0)
    await pace()
    await pace()
    await pace()
    expect(waits).toEqual([6000, 12_000])
  })

  it("does not wait when enough time has passed since the last call", async () => {
    let t = 0
    const pace = createPacer(60, () => t)
    await pace()
    t = 5000
    await pace()
    expect(waits).toEqual([])
  })

  it("treats a rate below one per minute as one per minute", async () => {
    const pace = createPacer(0, () => 0)
    await pace()
    await pace()
    expect(waits).toEqual([60_000])
  })
})
