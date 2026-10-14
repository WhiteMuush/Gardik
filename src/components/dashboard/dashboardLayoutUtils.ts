import type { GridItemLayout, WidgetMeta } from "@/types/dashboard"
import type { WidgetEntry } from "./DashboardCanvas"

export function buildDefaultLayout(widgets: WidgetEntry[]): GridItemLayout[] {
  let cursor = 0
  return widgets.map((w) => {
    const y = w.defaultPosition?.y ?? cursor
    const x = w.defaultPosition?.x ?? 0
    if (!w.defaultPosition) cursor += w.defaultSize.h
    return {
      i: w.instanceId,
      x,
      y,
      w: w.defaultSize.w,
      h: w.defaultSize.h,
      minW: w.minSize.w,
      minH: w.minSize.h,
    }
  })
}

export function buildDefaultMeta(widgets: WidgetEntry[]): WidgetMeta[] {
  return widgets.map((w) => ({
    instanceId: w.instanceId,
    title: null,
    visible: w.defaultVisible ?? true,
  }))
}

export function mergeLayout(saved: GridItemLayout[], widgets: WidgetEntry[]): GridItemLayout[] {
  return widgets.map((w) => {
    const s = saved.find((l) => l.i === w.instanceId)
    if (s) {
      return {
        ...s,
        w: Math.max(s.w, w.minSize.w),
        h: Math.max(s.h, w.minSize.h),
        minW: w.minSize.w,
        minH: w.minSize.h,
      }
    }
    return {
      i: w.instanceId,
      x: 0,
      y: Infinity,
      w: w.defaultSize.w,
      h: w.defaultSize.h,
      minW: w.minSize.w,
      minH: w.minSize.h,
    }
  })
}

type SwapItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }

// The widget overlapping the dragged footprint most, measured from `origin` against the pre-drag `pool`.
export function findSwapTarget<T extends SwapItem>(dragged: SwapItem, pool: T[]): T | null {
  const origin = pool.find((l) => l.i === dragged.i)
  if (!origin) return null
  const dx = dragged.x
  const dy = dragged.y
  const dw = origin.w
  const dh = origin.h
  let best: T | null = null
  let bestArea = 0
  for (const l of pool) {
    if (l.i === dragged.i) continue
    const ix = Math.min(dx + dw, l.x + l.w) - Math.max(dx, l.x)
    const iy = Math.min(dy + dh, l.y + l.h) - Math.max(dy, l.y)
    if (ix <= 0 || iy <= 0) continue
    const area = ix * iy
    if (area > bestArea) {
      bestArea = area
      best = l
    }
  }
  return best
}

// Shrinks row neighbours to reclaim the columns a resize ate, evicting below only those that cannot keep minW.
export function squeezeResize<T extends SwapItem>(
  items: SwapItem[],
  id: string,
  cols: number,
  pre: T[]
): T[] {
  const next = items.find((l) => l.i === id)
  const map = new Map(pre.map((l) => [l.i, { ...l }]))
  const resized = map.get(id)
  if (!next || !resized) return [...map.values()]
  // The resized widget squeezes only its original row band, while an evicted one reflows its full new span.
  const queue: { id: string; top: number; bottom: number }[] = [
    { id, top: resized.y, bottom: resized.y + resized.h },
  ]
  resized.x = next.x
  resized.y = next.y
  resized.w = next.w
  resized.h = next.h
  // Breadth-first reflow where each id pushes at most once, so it always terminates.
  const pushed = new Set<string>()
  while (queue.length > 0) {
    const { id: pid, top, bottom } = queue.shift() as { id: string; top: number; bottom: number }
    if (pushed.has(pid)) continue
    pushed.add(pid)
    const p = map.get(pid)
    if (!p) continue
    const pRight = p.x + p.w
    const pBottom = p.y + p.h
    for (const l of map.values()) {
      if (l.i === pid) continue
      const vOverlap = l.y < pBottom && p.y < l.y + l.h
      const hOverlap = l.x < pRight && p.x < l.x + l.w
      if (!vOverlap || !hOverlap) continue
      // Beside the band only, since a widget below it is left for compaction to push down.
      const beside = l.y < bottom && top < l.y + l.h
      if (!beside) continue
      const minW = l.minW ?? 1
      // A right neighbour slides and narrows, a left one is trimmed, and either is evicted below minW.
      const onRight = l.x + l.w / 2 >= p.x + p.w / 2
      if (onRight) {
        const x = pRight
        const w = Math.min(l.w, cols - x)
        if (w >= minW) {
          l.x = x
          l.w = w
          continue
        }
      } else {
        const w = p.x - l.x
        if (w >= minW) {
          l.w = w
          continue
        }
      }
      l.y = pBottom
      queue.push({ id: l.i, top: l.y, bottom: l.y + l.h })
    }
  }
  return [...map.values()]
}

// Skips redundant state writes, which would otherwise loop into "Maximum update depth exceeded".
export function sameGeometry(a: SwapItem[], b: SwapItem[]): boolean {
  if (a.length !== b.length) return false
  const by = new Map(b.map((l) => [l.i, l]))
  return a.every((l) => {
    const o = by.get(l.i)
    return !!o && o.x === l.x && o.y === l.y && o.w === l.w && o.h === l.h
  })
}

export function mergeMeta(saved: WidgetMeta[], widgets: WidgetEntry[]): WidgetMeta[] {
  return widgets.map((w) => {
    const s = saved.find((m) => m.instanceId === w.instanceId)
    return s ?? { instanceId: w.instanceId, title: null, visible: w.defaultVisible ?? true }
  })
}
