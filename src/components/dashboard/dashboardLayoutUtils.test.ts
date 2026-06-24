import { describe, it, expect } from "vitest"
import { findSwapTarget, sameGeometry } from "./dashboardLayoutUtils"

const pool = [
  { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: "b", x: 6, y: 0, w: 6, h: 8, minW: 2, minH: 2 },
  { i: "c", x: 0, y: 4, w: 4, h: 2, minW: 4, minH: 2 },
]

describe("findSwapTarget", () => {
  it("returns the widget whose slot the dragged centre falls in", () => {
    const dragged = { ...pool[0], x: 7, y: 1 } // centre lands inside b
    expect(findSwapTarget(dragged, pool)?.i).toBe("b")
  })
  it("returns null when the centre covers no other widget", () => {
    const dragged = { ...pool[0], x: 0, y: 20 }
    expect(findSwapTarget(dragged, pool)).toBeNull()
  })
  it("ignores the dragged widget's own slot", () => {
    const dragged = { ...pool[0], x: 0, y: 0 }
    expect(findSwapTarget(dragged, pool)).toBeNull()
  })
  it("allows a swap when both sides still satisfy their min size", () => {
    const dragged = { ...pool[0], x: 0, y: 2 } // centre (3,4) inside c
    expect(findSwapTarget(dragged, pool)?.i).toBe("c")
  })
  it("rejects when the target is too small for the dragged widget's min", () => {
    const wide = { i: "wide", x: 0, y: 0, w: 8, h: 4, minW: 6, minH: 2 }
    const small = { i: "small", x: 8, y: 0, w: 2, h: 2, minW: 1, minH: 1 }
    const dragged = { ...wide, x: 8, y: 0 } // centre inside small
    expect(findSwapTarget(dragged, [wide, small])).toBeNull()
  })
})

describe("sameGeometry", () => {
  const layout = [
    { i: "a", x: 0, y: 0, w: 6, h: 4 },
    { i: "b", x: 6, y: 0, w: 6, h: 8 },
  ]
  it("true for the same widgets at the same slots, order-independent", () => {
    expect(sameGeometry(layout, [layout[1], layout[0]])).toBe(true)
  })
  it("false when any widget moved or resized", () => {
    expect(sameGeometry(layout, [{ ...layout[0], x: 1 }, layout[1]])).toBe(false)
  })
  it("false when the widget set differs", () => {
    expect(sameGeometry(layout, [layout[0]])).toBe(false)
  })
})
