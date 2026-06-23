import { describe, it, expect } from "vitest"
import {
  buildBreachSources,
  buildDataTypes,
  buildTrendData,
  type BreachCatalogEntry,
  type BreachRecordRaw,
} from "./dashboard"

const records: BreachRecordRaw[] = [
  { detectedAt: new Date(), exposedData: ["email", "password"], sources: ["HIBP"] },
  { detectedAt: new Date(), exposedData: ["password"], sources: ["DEHASHED"] },
  { detectedAt: new Date(), exposedData: ["email"], sources: [] }, // legacy, no tag
]

describe("buildDataTypes", () => {
  it("counts every record when no provider is given", () => {
    const out = buildDataTypes(records)
    expect(out.find((d) => d.type === "email")?.count).toBe(2)
    expect(out.find((d) => d.type === "password")?.count).toBe(2)
  })
  it("counts only the chosen provider's records", () => {
    const out = buildDataTypes(records, "HIBP")
    expect(out.find((d) => d.type === "email")?.count).toBe(1)
    expect(out.find((d) => d.type === "password")?.count).toBe(1)
  })
  it("excludes untagged legacy records under a provider filter", () => {
    const out = buildDataTypes(records, "DEHASHED")
    expect(out.find((d) => d.type === "email")).toBeUndefined()
    expect(out.find((d) => d.type === "password")?.count).toBe(1)
  })
})

describe("buildTrendData", () => {
  it("filters the monthly counts by provider", () => {
    const all = buildTrendData(records).reduce((s, m) => s + m.count, 0)
    const hibp = buildTrendData(records, "HIBP").reduce((s, m) => s + m.count, 0)
    expect(all).toBe(3)
    expect(hibp).toBe(1)
  })
})

const catalog: BreachCatalogEntry[] = [
  {
    id: "b1",
    name: "LinkedIn",
    source: "HIBP",
    breachDate: new Date("2021-01-01"),
    dataTypes: ["email"],
    records: [
      { employeeId: "e1", sources: ["HIBP"] },
      { employeeId: "e2", sources: ["DEHASHED"] },
    ],
  },
  {
    id: "b2",
    name: "DarkForum",
    source: "DARK_WEB",
    breachDate: new Date("2022-01-01"),
    dataTypes: ["password"],
    records: [{ employeeId: "e3", sources: ["DEHASHED"] }],
  },
]

describe("buildBreachSources", () => {
  it("returns every breach with full affected counts when unscoped", () => {
    const out = buildBreachSources(catalog)
    expect(out).toHaveLength(2)
    expect(out.find((b) => b.id === "b1")?.affectedEmployees).toBe(2)
  })
  it("drops breaches with no record from the chosen provider", () => {
    const out = buildBreachSources(catalog, "HIBP")
    expect(out.map((b) => b.id)).toEqual(["b1"])
    expect(out[0].affectedEmployees).toBe(1)
  })
  it("keeps only matching records in the affected count", () => {
    const out = buildBreachSources(catalog, "DEHASHED")
    expect(out.map((b) => b.id).sort()).toEqual(["b1", "b2"])
    expect(out.find((b) => b.id === "b1")?.affectedEmployees).toBe(1)
  })
})
