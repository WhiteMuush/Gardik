import { describe, it, expect } from "vitest"
import { buildCsp } from "./csp"

describe("buildCsp", () => {
  it("embeds the nonce in script-src with strict-dynamic", () => {
    const csp = buildCsp("abc123", false)
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
  })

  it("omits dev-only sources in production", () => {
    const csp = buildCsp("abc123", false)
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).not.toContain("ws:")
  })

  it("adds unsafe-eval and ws: in development", () => {
    const csp = buildCsp("abc123", true)
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain("connect-src 'self' ws:")
  })

  it("locks down framing and object sources", () => {
    const csp = buildCsp("abc123", false)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })
})
