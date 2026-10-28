import { describe, expect, it } from "vitest"
import { DATA_TYPE_GROUPS, PRESET_DATA_TYPES } from "./dataTypes"

describe("PRESET_DATA_TYPES", () => {
  it("puts every type in a known group", () => {
    for (const t of PRESET_DATA_TYPES) expect(DATA_TYPE_GROUPS).toContain(t.group)
  })

  it("keeps each group at seven types or fewer", () => {
    for (const g of DATA_TYPE_GROUPS) {
      const size = PRESET_DATA_TYPES.filter((t) => t.group === g).length
      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThanOrEqual(7)
    }
  })
})
