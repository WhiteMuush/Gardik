import { describe, it, expect, vi } from "vitest"
import { canonicalBreachKey, normalizeArtifact, normalizeType, parseBreachDate, sleep } from "./normalize"

describe("normalizeType", () => {
  it("lowercases, trims, and snake_cases whitespace runs", () => {
    expect(normalizeType("  Hashed Password ")).toBe("hashed_password")
    expect(normalizeType("Credit   Card")).toBe("credit_card")
    expect(normalizeType("EMAIL")).toBe("email")
  })
})

describe("normalizeArtifact", () => {
  it("maps known stealer artifact labels to a kind", () => {
    expect(normalizeArtifact("Session Cookie")).toBe("COOKIE")
    expect(normalizeArtifact("auth token")).toBe("TOKEN")
    expect(normalizeArtifact("JWT")).toBe("TOKEN")
    expect(normalizeArtifact("Autofill data")).toBe("AUTOFILL")
    expect(normalizeArtifact("Saved password")).toBe("PASSWORD")
  })
  it("returns null for an unrecognized label", () => {
    expect(normalizeArtifact("screenshot")).toBeNull()
  })
})

describe("canonicalBreachKey", () => {
  it("folds case, whitespace, punctuation and a trailing TLD", () => {
    expect(canonicalBreachKey("LinkedIn")).toBe("linkedin")
    expect(canonicalBreachKey("  linkedin ")).toBe("linkedin")
    expect(canonicalBreachKey("LinkedIn.com")).toBe("linkedin")
    expect(canonicalBreachKey("Linked-In")).toBe("linkedin")
  })
  it("keeps digits so numbered collections stay distinct", () => {
    expect(canonicalBreachKey("Collection #1")).toBe("collection1")
    expect(canonicalBreachKey("Collection #2")).toBe("collection2")
    expect(canonicalBreachKey("Collection #1")).not.toBe(canonicalBreachKey("Collection #2"))
  })
  it("does not collapse different namespaces onto the same key", () => {
    expect(canonicalBreachKey("leaks.public.general")).not.toBe(canonicalBreachKey("LinkedIn"))
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
