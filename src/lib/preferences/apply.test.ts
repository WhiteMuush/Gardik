import { describe, it, expect } from "vitest"
import { DEFAULT_PREFERENCES } from "./schema"
import { preferenceAttributes, resolveHomePage } from "./apply"

describe("preferenceAttributes", () => {
  it("writes every display choice as a data attribute of the page", () => {
    expect(preferenceAttributes(DEFAULT_PREFERENCES)).toEqual({
      "data-theme": "system",
      "data-accent": "violet",
      "data-text-size": "default",
      "data-motion": "system",
      "data-colorblind": undefined,
      "data-readable-font": undefined,
    })
  })

  it("sets the switches only when they are on", () => {
    const attrs = preferenceAttributes({ ...DEFAULT_PREFERENCES, colorblind: true, readableFont: true })
    expect(attrs["data-colorblind"]).toBe("")
    expect(attrs["data-readable-font"]).toBe("")
  })
})

describe("resolveHomePage", () => {
  const visible = ["/dashboard", "/alerts", "/security", "/preferences"]

  it("uses the chosen page when the role can still open it", () => {
    expect(resolveHomePage("/alerts", visible, "/dashboard")).toBe("/alerts")
  })

  it("falls back to the role default when the page is gone or never chosen", () => {
    expect(resolveHomePage("/employees", visible, "/dashboard")).toBe("/dashboard")
    expect(resolveHomePage(null, visible, "/dashboard")).toBe("/dashboard")
  })
})
