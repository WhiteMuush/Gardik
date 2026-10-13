import { describe, it, expect } from "vitest"
import {
  confidenceForProvider,
  providerMeta,
  API_PROVIDERS,
  recommendationLevel,
  providersByLevel,
  priceLabel,
} from "./providers"

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

describe("recommendation levels", () => {
  it("follows the reliability tier", () => {
    expect(recommendationLevel(1)).toBe("Recommended")
    expect(recommendationLevel(2)).toBe("Additional")
    expect(recommendationLevel(3)).toBe("Free or limited")
  })

  it("recommends HIBP and its stealer logs, and keeps Intelligence X for its free tier", () => {
    const groups = providersByLevel()
    expect(groups.map((g) => g.level)).toEqual(["Recommended", "Additional", "Free or limited"])
    expect(groups[0].providers.map((p) => p.id)).toEqual(["HIBP", "HIBP_STEALER"])
    expect(groups[1].providers.map((p) => p.id).sort()).toEqual(["DEHASHED", "LEAKCHECK", "SNUSBASE"])
    expect(groups[2].providers.map((p) => p.id)).toEqual(["INTELX"])
  })
})

describe("pricing", () => {
  it("gives every provider an official pricing page and the date it was checked", () => {
    for (const p of API_PROVIDERS) {
      expect(p.pricing.url).toMatch(/^https:\/\//)
      expect(p.pricing.checkedOn).toBe("October 2026")
    }
  })

  it("says when a price is not published instead of guessing", () => {
    expect(priceLabel(providerMeta("HIBP")!)).toBe("From $4.39/month, checked October 2026")
    expect(priceLabel(providerMeta("DEHASHED")!)).toBe("Price not published, checked October 2026")
  })
})
