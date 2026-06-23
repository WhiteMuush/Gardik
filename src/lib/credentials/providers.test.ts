import { describe, it, expect } from "vitest"
import { confidenceForProvider, providerMeta, API_PROVIDERS } from "./providers"

describe("provider tiers", () => {
  it("assigns every provider a tier between 1 and 3", () => {
    for (const p of API_PROVIDERS) {
      expect(p.tier).toBeGreaterThanOrEqual(1)
      expect(p.tier).toBeLessThanOrEqual(3)
    }
  })
  it("keeps curated feeds at tier 1 and noisy OSINT at tier 3", () => {
    expect(providerMeta("HIBP")?.tier).toBe(1)
    expect(providerMeta("HIBP_STEALER")?.tier).toBe(1)
    expect(providerMeta("INTELX")?.tier).toBe(3)
  })
})

describe("confidenceForProvider", () => {
  it("maps tier 1 to HIGH, tier 2 to MEDIUM, tier 3 to LOW", () => {
    expect(confidenceForProvider("HIBP")).toBe("HIGH")
    expect(confidenceForProvider("DEHASHED")).toBe("MEDIUM")
    expect(confidenceForProvider("INTELX")).toBe("LOW")
  })
})
