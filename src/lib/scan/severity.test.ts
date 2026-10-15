import { describe, it, expect } from "vitest"
import { severityFor } from "./severity"

describe("severityFor", () => {
  it("is CRITICAL with two or more critical data types", () => {
    expect(severityFor(["password", "ssn"])).toBe("CRITICAL")
    expect(severityFor(["password", "credit_card", "email"])).toBe("CRITICAL")
  })
  it("is HIGH with exactly one critical type", () => {
    expect(severityFor(["password", "email"])).toBe("HIGH")
  })
  it("is MEDIUM with no critical type", () => {
    expect(severityFor(["email", "username"])).toBe("MEDIUM")
    expect(severityFor([])).toBe("MEDIUM")
  })
  it("is CRITICAL when a session cookie or token leaks, whatever the source", () => {
    expect(severityFor([], ["COOKIE"])).toBe("CRITICAL")
    expect(severityFor(["email"], ["TOKEN"])).toBe("CRITICAL")
    expect(severityFor([], ["COOKIE"], "STEALER_LOG")).toBe("CRITICAL")
    expect(severityFor([], ["TOKEN"], "DARK_WEB")).toBe("CRITICAL")
  })
  it("ignores non-session artifacts for the override on breach dumps", () => {
    expect(severityFor(["email"], ["PASSWORD"])).toBe("MEDIUM")
    expect(severityFor(["password"], ["AUTOFILL"])).toBe("HIGH")
  })
  it("never rates a stealer log below HIGH (active endpoint infection)", () => {
    expect(severityFor([], [], "STEALER_LOG")).toBe("HIGH")
    expect(severityFor(["email"], [], "STEALER_LOG")).toBe("HIGH")
    expect(severityFor(["email"], ["AUTOFILL"], "STEALER_LOG")).toBe("HIGH")
  })
  it("is CRITICAL for a stealer log with stolen credentials", () => {
    expect(severityFor(["email"], ["PASSWORD"], "STEALER_LOG")).toBe("CRITICAL")
    expect(severityFor(["password"], [], "STEALER_LOG")).toBe("CRITICAL")
  })
  it("applies data-type logic to dark-web and curated dumps alike", () => {
    expect(severityFor([], [], "DARK_WEB")).toBe("MEDIUM")
    expect(severityFor(["password"], [], "DARK_WEB")).toBe("HIGH")
    expect(severityFor(["password", "ssn"], [], "DARK_WEB")).toBe("CRITICAL")
    expect(severityFor(["password"], [], "HIBP")).toBe("HIGH")
  })
})
