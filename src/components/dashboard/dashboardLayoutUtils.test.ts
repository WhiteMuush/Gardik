import { describe, it, expect } from "vitest"
import { findSwapTarget, sameGeometry, squeezeResize } from "./dashboardLayoutUtils"

const pool = [
  { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: "b", x: 6, y: 0, w: 6, h: 8, minW: 2, minH: 2 },
  { i: "c", x: 0, y: 4, w: 4, h: 2, minW: 4, minH: 2 },
]

describe("findSwapTarget", () => {
  it("returns the widget the dragged footprint overlaps", () => {
    const dragged = { ...pool[0], x: 7, y: 1 } // 6x4 footprint overlaps b most
    expect(findSwapTarget(dragged, pool)?.i).toBe("b")
  })
  it("returns null when the footprint covers no other widget", () => {
    const dragged = { ...pool[0], x: 0, y: 20 }
    expect(findSwapTarget(dragged, pool)).toBeNull()
  })
  it("ignores the dragged widget's own slot", () => {
    const dragged = { ...pool[0], x: 0, y: 0 }
    expect(findSwapTarget(dragged, pool)).toBeNull()
  })
  it("picks the widget with the largest overlap when several are touched", () => {
    const d = { i: "d", x: 0, y: 0, w: 4, h: 4 }
    const t1 = { i: "t1", x: 0, y: 0, w: 4, h: 4 }
    const t2 = { i: "t2", x: 4, y: 0, w: 4, h: 4 }
    // d's footprint at x:3 overlaps t1 by 1 col, t2 by 3 cols -> t2 wins.
    const dragged = { ...d, x: 3, y: 0 }
    expect(findSwapTarget(dragged, [d, t1, t2])?.i).toBe("t2")
  })
  it("is permissive: still targets a smaller widget regardless of min size", () => {
    const wide = { i: "wide", x: 0, y: 0, w: 8, h: 4, minW: 6, minH: 2 }
    const small = { i: "small", x: 8, y: 0, w: 2, h: 2, minW: 1, minH: 1 }
    const dragged = { ...wide, x: 8, y: 0 } // footprint overlaps small
    expect(findSwapTarget(dragged, [wide, small])?.i).toBe("small")
  })
})

describe("squeezeResize", () => {
  const cols = 12
  // Two widgets sharing the row, 6 + 6.
  const pre = [
    { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
    { i: "b", x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  ]

  it("shrinks the right neighbour to reclaim the grown columns", () => {
    const items = [{ ...pre[0], w: 8 }, pre[1]]
    const out = squeezeResize(items, "a", cols, pre)
    expect(out.find((l) => l.i === "a")).toMatchObject({ x: 0, w: 8 })
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 8, w: 4, y: 0 })
  })

  it("evicts the neighbour below when it can't shrink past minW", () => {
    const items = [{ ...pre[0], w: 11 }, pre[1]] // leaves 1 col, b.minW = 2
    const out = squeezeResize(items, "a", cols, pre)
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 6, w: 6, y: 4 })
  })

  it("trims a left neighbour when the resized widget grows from its left edge", () => {
    const items = [pre[0], { ...pre[1], x: 4, w: 8 }] // b's left handle dragged left
    const out = squeezeResize(items, "b", cols, pre)
    expect(out.find((l) => l.i === "a")).toMatchObject({ x: 0, w: 4 })
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 4, w: 8 })
  })

  it("makes the evicted widget squeeze its landing row instead of pushing it down", () => {
    // a + b on top, c spans the full width below. Growing a evicts b (minW 4
    // won't fit the 3 leftover cols); b lands on c's row, so c must shrink to share.
    const stacked = [
      { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "b", x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 2 },
      { i: "c", x: 0, y: 4, w: 12, h: 4, minW: 2, minH: 2 },
    ]
    const items = [{ ...stacked[0], w: 9 }, stacked[1], stacked[2]]
    const out = squeezeResize(items, "a", cols, stacked)
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 6, y: 4, w: 6 })
    expect(out.find((l) => l.i === "c")).toMatchObject({ x: 0, y: 4, w: 6 })
  })

  it("leaves a stacked widget for vertical compaction on vertical grow, no squeeze", () => {
    // a taller; c is stacked directly below it, b sits beside. Neither width changes,
    // c keeps its slot here (the caller's vertical compaction pushes it down).
    const col = [
      { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "b", x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "c", x: 0, y: 4, w: 6, h: 4, minW: 2, minH: 2 },
    ]
    const items = [{ ...col[0], h: 6 }, col[1], col[2]]
    const out = squeezeResize(items, "a", cols, col)
    expect(out.find((l) => l.i === "c")).toMatchObject({ x: 0, y: 4, w: 6 })
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 6, y: 0, w: 6 })
  })

  it("leaves widgets that don't overlap the new footprint untouched", () => {
    const stacked = [
      { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "c", x: 0, y: 4, w: 6, h: 4, minW: 2, minH: 2 },
    ]
    const items = [{ ...stacked[0], w: 8 }, stacked[1]]
    const out = squeezeResize(items, "a", cols, stacked)
    expect(out.find((l) => l.i === "c")).toMatchObject({ x: 0, y: 4, w: 6 })
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
