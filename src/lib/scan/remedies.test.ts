import { describe, it, expect } from "vitest"
import { remedyFor } from "./remedies"

describe("remedyFor", () => {
  it("walks a rejected key through replacing it on the Data API page", () => {
    const r = remedyFor("HIBP", "API key rejected")
    expect(r.title).toBe("Have I Been Pwned rejected the API key")
    expect(r.steps.some((s) => s.href === "/data-api")).toBe(true)
    expect(r.steps.at(-1)?.text).toMatch(/Scan unchecked/)
  })

  it("explains a rate limit and points to the rate setting", () => {
    const r = remedyFor("LEAKCHECK", "Rate limited by the source")
    expect(r.title).toBe("LeakCheck refused calls over your plan's limit")
    expect(r.steps.some((s) => s.href === "/data-api")).toBe(true)
  })

  it("covers outages, network errors and slow searches", () => {
    expect(remedyFor("HIBP", "Source unavailable (HTTP 503)").title).toBe("Have I Been Pwned is unavailable")
    expect(remedyFor("HIBP", "Network error").title).toBe("Gardik could not reach Have I Been Pwned")
    expect(remedyFor("INTELX", "Search did not finish in time").title).toBe(
      "Intelligence X did not finish the search in time"
    )
  })

  it("falls back to a generic remedy for any other error", () => {
    const r = remedyFor("DEHASHED", "Unexpected response (HTTP 418)")
    expect(r.title).toBe("DeHashed returned an unexpected answer")
    expect(r.explanation).toContain("Unexpected response (HTTP 418)")
  })

  it("explains employees that were simply never checked", () => {
    const r = remedyFor("HIBP", null)
    expect(r.title).toBe("Have I Been Pwned has not checked these employees yet")
    expect(r.steps).toHaveLength(1)
  })

  it("links to the provider when the fix happens on its side", () => {
    const r = remedyFor("HIBP", "API key rejected")
    expect(r.steps.some((s) => s.href === "https://haveibeenpwned.com/API/Key")).toBe(true)
  })

  it("points to the settings below when read inside the source panel", () => {
    const r = remedyFor("HIBP", "API key rejected", "source")
    expect(r.steps.some((s) => s.href === "/data-api")).toBe(false)
    expect(r.steps.map((s) => s.text)).toContain("Paste it in Configuration below and click Replace.")
  })
})
