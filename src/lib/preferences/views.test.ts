import { describe, it, expect } from "vitest"
import { isViewPage, parseView, readViews } from "./views"

describe("parseView", () => {
  it("keeps the known fields of the page and drops empty ones", () => {
    expect(parseView("employees", { risk: "HIGH", department: "", sort: "risk:desc", other: "x" })).toEqual({
      ok: true,
      view: { risk: "HIGH", sort: "risk:desc" },
    })
  })

  it("refuses a value that is not a short string", () => {
    expect(parseView("alerts", { status: 3 })).toEqual({ ok: false, error: "Invalid status" })
    expect(parseView("alerts", { status: "x".repeat(101) })).toEqual({ ok: false, error: "Invalid status" })
  })

  it("refuses a body that is not an object", () => {
    expect(parseView("alerts", "OPEN")).toEqual({ ok: false, error: "Invalid view" })
  })
})

describe("isViewPage", () => {
  it("knows only the pages that keep a view", () => {
    expect(isViewPage("employees")).toBe(true)
    expect(isViewPage("alerts")).toBe(true)
    expect(isViewPage("access")).toBe(false)
  })
})

describe("readViews", () => {
  it("ignores stored junk and unknown pages", () => {
    expect(readViews({ alerts: { status: "OPEN" }, access: { x: "y" }, employees: "bad" })).toEqual({
      alerts: { status: "OPEN" },
    })
    expect(readViews(null)).toEqual({})
  })
})
