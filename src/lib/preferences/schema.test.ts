import { describe, it, expect } from "vitest"
import { DEFAULT_PREFERENCES, parsePreferencesPatch, sanitizePreferences } from "./schema"

describe("parsePreferencesPatch", () => {
  it("keeps only the known fields with allowed values", () => {
    const result = parsePreferencesPatch({ theme: "dark", accent: "teal", extra: "ignored" })
    expect(result).toEqual({ ok: true, patch: { theme: "dark", accent: "teal" } })
  })

  it("refuses a value outside the allowed list", () => {
    expect(parsePreferencesPatch({ theme: "neon" })).toEqual({ ok: false, error: "Invalid theme" })
    expect(parsePreferencesPatch({ textSize: 3 })).toEqual({ ok: false, error: "Invalid textSize" })
  })

  it("accepts booleans only for the switches", () => {
    expect(parsePreferencesPatch({ colorblind: true, readableFont: false })).toEqual({
      ok: true,
      patch: { colorblind: true, readableFont: false },
    })
    expect(parsePreferencesPatch({ colorblind: "yes" })).toEqual({ ok: false, error: "Invalid colorblind" })
  })

  it("accepts a real IANA zone, null for automatic, and refuses anything else", () => {
    expect(parsePreferencesPatch({ timeZone: "Europe/Paris" })).toEqual({
      ok: true,
      patch: { timeZone: "Europe/Paris" },
    })
    expect(parsePreferencesPatch({ timeZone: null })).toEqual({ ok: true, patch: { timeZone: null } })
    expect(parsePreferencesPatch({ timeZone: "Mars/Olympus" })).toEqual({
      ok: false,
      error: "Invalid timeZone",
    })
  })

  it("accepts a home page path or null, never an outside URL", () => {
    expect(parsePreferencesPatch({ homePage: "/alerts" })).toEqual({
      ok: true,
      patch: { homePage: "/alerts" },
    })
    expect(parsePreferencesPatch({ homePage: null })).toEqual({ ok: true, patch: { homePage: null } })
    expect(parsePreferencesPatch({ homePage: "https://evil.example" })).toEqual({
      ok: false,
      error: "Invalid homePage",
    })
    expect(parsePreferencesPatch({ homePage: "//evil.example" })).toEqual({
      ok: false,
      error: "Invalid homePage",
    })
  })

  it("refuses a body that is not an object or sets nothing", () => {
    expect(parsePreferencesPatch(null)).toEqual({ ok: false, error: "Nothing to save" })
    expect(parsePreferencesPatch({})).toEqual({ ok: false, error: "Nothing to save" })
  })
})

describe("sanitizePreferences", () => {
  it("falls back to the default for a stored value that is no longer allowed", () => {
    const stored = { ...DEFAULT_PREFERENCES, theme: "sepia", accent: "teal", timeZone: "Nowhere/Land" }
    expect(sanitizePreferences(stored)).toEqual({ ...DEFAULT_PREFERENCES, accent: "teal" })
  })

  it("returns the defaults when nothing is stored", () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES)
  })
})
