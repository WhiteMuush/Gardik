import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("../normalize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../normalize")>()),
  sleep: () => Promise.resolve(),
}))

import { PROVIDERS } from "../registry"
import { ProviderError } from "../errors"
import { intelx } from "./intelx"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("every provider", () => {
  it.each(PROVIDERS.map((p) => [p.id, p] as const))(
    "%s declares a positive default rate",
    (_id, provider) => {
      expect(provider.defaultRatePerMinute).toBeGreaterThan(0)
    }
  )

  it.each(PROVIDERS.map((p) => [p.id, p] as const))(
    "%s surfaces a rate limit with its Retry-After",
    async (_id, provider) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "retry-after": "7" } }))
      )
      const err = await provider.lookup("a@x.com", "k").catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ProviderError)
      expect((err as ProviderError).status).toBe(429)
      expect((err as ProviderError).retryAfterMs).toBe(7000)
    }
  )
})

describe("intelx", () => {
  it("fails instead of returning partial results when fetching results fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ id: "s1", status: 0 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
    )
    const err = await intelx.lookup("a@x.com", "k").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect((err as ProviderError).status).toBe(503)
  })

  it("fails when the search never finishes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) =>
        url.endsWith("/intelligent/search") ? json({ id: "s1", status: 0 }) : json({ records: [], status: 3 })
      )
    )
    const err = await intelx.lookup("a@x.com", "k").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect((err as ProviderError).status).toBeNull()
  })

  it("returns the findings once the search completes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ id: "s1", status: 0 }))
        .mockResolvedValueOnce(json({ records: [{ bucket: "leaks.public" }], status: 1 }))
    )
    const findings = await intelx.lookup("a@x.com", "k")
    expect(findings.map((f) => f.name)).toEqual(["leaks.public"])
  })
})
