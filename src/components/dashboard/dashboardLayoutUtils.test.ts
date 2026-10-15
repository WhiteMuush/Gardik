import { describe, it, expect } from "vitest"
import { findSwapTarget, sameGeometry, squeezeResize } from "./dashboardLayoutUtils"

const poolA = { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 }
const pool = [
  poolA,
  { i: "b", x: 6, y: 0, w: 6, h: 8, minW: 2, minH: 2 },
  { i: "c", x: 0, y: 4, w: 4, h: 2, minW: 4, minH: 2 },
]

describe("findSwapTarget", () => {
  it("returns the widget the dragged footprint overlaps", () => {
    const dragged = { ...poolA, x: 7, y: 1 } // 6x4 footprint overlaps b most
    expect(findSwapTarget(dragged, pool)?.i).toBe("b")
  })
  it("returns null when the footprint covers no other widget", () => {
    const dragged = { ...poolA, x: 0, y: 20 }
    expect(findSwapTarget(dragged, pool)).toBeNull()
  })
  it("ignores the dragged widget's own slot", () => {
    const dragged = { ...poolA, x: 0, y: 0 }
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
  const [preA, preB] = [
    { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
    { i: "b", x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  ]
  const pre = [preA, preB]

  it("shrinks the right neighbour to reclaim the grown columns", () => {
    const items = [{ ...preA, w: 8 }, preB]
    const out = squeezeResize(items, "a", cols, pre)
    expect(out.find((l) => l.i === "a")).toMatchObject({ x: 0, w: 8 })
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 8, w: 4, y: 0 })
  })

  it("evicts the neighbour below when it can't shrink past minW", () => {
    const items = [{ ...preA, w: 11 }, preB] // leaves 1 col, b.minW = 2
    const out = squeezeResize(items, "a", cols, pre)
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 6, w: 6, y: 4 })
  })

  it("trims a left neighbour when the resized widget grows from its left edge", () => {
    const items = [preA, { ...preB, x: 4, w: 8 }] // b's left handle dragged left
    const out = squeezeResize(items, "b", cols, pre)
    expect(out.find((l) => l.i === "a")).toMatchObject({ x: 0, w: 4 })
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 4, w: 8 })
  })

  it("makes the evicted widget squeeze its landing row instead of pushing it down", () => {
    // Growing a evicts b (minW 4 cannot fit 3 columns), so b lands on c's row and c shrinks to share.
    const [a, b, c] = [
      { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "b", x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 2 },
      { i: "c", x: 0, y: 4, w: 12, h: 4, minW: 2, minH: 2 },
    ]
    const stacked = [a, b, c]
    const items = [{ ...a, w: 9 }, b, c]
    const out = squeezeResize(items, "a", cols, stacked)
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 6, y: 4, w: 6 })
    expect(out.find((l) => l.i === "c")).toMatchObject({ x: 0, y: 4, w: 6 })
  })

  it("leaves a stacked widget for vertical compaction on vertical grow, no squeeze", () => {
    // a grows with c below and b beside; c keeps its slot, as the caller's compaction pushes it down.
    const [a, b, c] = [
      { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "b", x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "c", x: 0, y: 4, w: 6, h: 4, minW: 2, minH: 2 },
    ]
    const col = [a, b, c]
    const items = [{ ...a, h: 6 }, b, c]
    const out = squeezeResize(items, "a", cols, col)
    expect(out.find((l) => l.i === "c")).toMatchObject({ x: 0, y: 4, w: 6 })
    expect(out.find((l) => l.i === "b")).toMatchObject({ x: 6, y: 0, w: 6 })
  })

  it("leaves widgets that don't overlap the new footprint untouched", () => {
    const [a, c] = [
      { i: "a", x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
      { i: "c", x: 0, y: 4, w: 6, h: 4, minW: 2, minH: 2 },
    ]
    const stacked = [a, c]
    const items = [{ ...a, w: 8 }, c]
    const out = squeezeResize(items, "a", cols, stacked)
    expect(out.find((l) => l.i === "c")).toMatchObject({ x: 0, y: 4, w: 6 })
  })
})

describe("sameGeometry", () => {
  const [la, lb] = [
    { i: "a", x: 0, y: 0, w: 6, h: 4 },
    { i: "b", x: 6, y: 0, w: 6, h: 8 },
  ]
  const layout = [la, lb]
  it("true for the same widgets at the same slots, order-independent", () => {
    expect(sameGeometry(layout, [lb, la])).toBe(true)
  })
  it("false when any widget moved or resized", () => {
    expect(sameGeometry(layout, [{ ...la, x: 1 }, lb])).toBe(false)
  })
  it("false when the widget set differs", () => {
    expect(sameGeometry(layout, [la])).toBe(false)
  })
})
