import { describe, it, expect } from "vitest"
import {
  generateToken,
  hashToken,
  isExpired,
  passwordProblem,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "./invitation"

describe("generateToken", () => {
  it("produces a url-safe token with no repeats across a large sample", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken))
    expect(tokens.size).toBe(1000)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  // 32 bytes, base64url, so 43 characters with no padding. Asserted because the
  // whole flow's security is this number: shorten it and the link becomes
  // guessable without anything else in the code looking wrong.
  it("carries 32 bytes of entropy", () => {
    expect(generateToken()).toHaveLength(43)
  })
})

describe("hashToken", () => {
  it("never returns the token it was given", () => {
    const token = generateToken()
    expect(hashToken(token)).not.toBe(token)
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is stable, so a token can be looked up by its stored hash", () => {
    const token = generateToken()
    expect(hashToken(token)).toBe(hashToken(token))
  })

  it("separates tokens that differ by a single character", () => {
    expect(hashToken("aaaa")).not.toBe(hashToken("aaab"))
  })
})

describe("passwordProblem", () => {
  it("accepts a password at the minimum length", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })

  it("rejects anything shorter", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1))).toContain("at least")
  })

  // bcrypt truncates past 72 bytes, so a longer passphrase would quietly lose
  // its tail and offer less protection than the user believes.
  it("rejects a passphrase past bcrypt's truncation point", () => {
    expect(passwordProblem("a".repeat(MAX_PASSWORD_LENGTH + 1))).toContain("at most")
  })

  it("counts bytes rather than characters, since bcrypt truncates bytes", () => {
    // 24 emoji at 4 bytes each is 96 bytes, well past the limit, but only 24
    // code points: a length check would have waved it through.
    expect(passwordProblem("\u{1F600}".repeat(24))).toContain("at most")
  })
})

describe("isExpired", () => {
  const now = new Date("2026-08-15T12:00:00Z")

  it("treats a future expiry as live", () => {
    expect(isExpired(new Date("2026-08-15T12:00:01Z"), now)).toBe(false)
  })

  it("treats the exact expiry instant as expired", () => {
    expect(isExpired(now, now)).toBe(true)
  })

  it("treats a past expiry as expired", () => {
    expect(isExpired(new Date("2026-08-15T11:59:59Z"), now)).toBe(true)
  })
})
