import { describe, it, expect } from "vitest"
import { ProviderError, errorFromResponse, failureReason, isRetryable, parseRetryAfter } from "./errors"

describe("parseRetryAfter", () => {
  it("reads a delay in seconds", () => {
    expect(parseRetryAfter("2")).toBe(2000)
  })
  it("reads an HTTP date relative to now", () => {
    const now = Date.parse("2026-10-12T10:00:00Z")
    expect(parseRetryAfter("Mon, 12 Oct 2026 10:00:30 GMT", now)).toBe(30_000)
  })
  it("returns null when absent or unreadable", () => {
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter("soon")).toBeNull()
  })
})

describe("errorFromResponse", () => {
  it("keeps the status and the Retry-After delay", () => {
    const res = new Response(null, { status: 429, headers: { "retry-after": "3" } })
    const err = errorFromResponse("HIBP", res)
    expect(err.status).toBe(429)
    expect(err.retryAfterMs).toBe(3000)
  })
})

describe("isRetryable", () => {
  it("retries rate limits, server errors and network failures", () => {
    expect(isRetryable(new ProviderError("x", 429))).toBe(true)
    expect(isRetryable(new ProviderError("x", 503))).toBe(true)
    expect(isRetryable(new ProviderError("x", null))).toBe(true)
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true)
  })
  it("does not retry a rejected key or a bad request", () => {
    expect(isRetryable(new ProviderError("x", 401))).toBe(false)
    expect(isRetryable(new ProviderError("x", 400))).toBe(false)
  })
  it("does not retry an unexpected error such as a bad payload", () => {
    expect(isRetryable(new SyntaxError("Unexpected token"))).toBe(false)
  })
})

describe("failureReason", () => {
  it("names the cause in words an operator can act on", () => {
    expect(failureReason(new ProviderError("x", 429))).toBe("Rate limited by the source")
    expect(failureReason(new ProviderError("x", 401))).toBe("API key rejected")
    expect(failureReason(new ProviderError("x", 403))).toBe("API key rejected")
    expect(failureReason(new ProviderError("x", 502))).toBe("Source unavailable (HTTP 502)")
    expect(failureReason(new ProviderError("x", 418))).toBe("Unexpected response (HTTP 418)")
    expect(failureReason(new ProviderError("Search did not finish", null))).toBe("Search did not finish")
    expect(failureReason(new TypeError("fetch failed"))).toBe("Network error")
    expect(failureReason(new SyntaxError("bad json"))).toBe("Unexpected error")
  })
})
