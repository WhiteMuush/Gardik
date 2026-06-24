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

// Pick the widget a dragged item should swap with: the one whose slot overlaps
// the dragged widget's footprint the most. Permissive on purpose, any overlap
// qualifies, so the swap triggers as soon as the dragged widget meaningfully
// covers another. Size compatibility is NOT gated here; the caller clamps the
// exchanged sizes to each widget's min and lets compaction tidy up. `pool` is
// the pre-drag layout: during a drag every other widget stays where it began,
// so the pool also gives each target's real slot. The dragged widget keeps its
// original footprint during the drag, so we measure overlap from `origin`.
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

// Resize behaviour: instead of letting a growing widget shove its row neighbour
// straight down, shrink that neighbour to reclaim the columns the resize ate.
// Only when the neighbour can't shrink past its minW do we evict it below the
// resized widget, and the evicted widget then squeezes its own landing row the
// same way, so an eviction reflows the zone underneath rather than just pushing
// the whole page down. `items` is RGL's live layout (the resized widget already
// at its new geometry); every other widget is rebuilt from `pre` (the pre-resize
// snapshot) so the engine's own push never leaks in. The caller runs a vertical
// compaction on the result to close any gaps the reflow leaves.
export function squeezeResize<T extends SwapItem>(items: SwapItem[], id: string, cols: number, pre: T[]): T[] {
  const next = items.find((l) => l.i === id)
  const map = new Map(pre.map((l) => [l.i, { ...l }]))
  const resized = map.get(id)
  if (!next || !resized) return [...map.values()]
  resized.x = next.x
  resized.y = next.y
  resized.w = next.w
  resized.h = next.h
  // Breadth-first reflow: a "pusher" squeezes every widget it overlaps; any widget
  // it has to evict downward joins the queue and squeezes its own landing row in
  // turn. Each id pushes at most once (guard set), so this always terminates.
  const queue = [id]
  const pushed = new Set<string>()
  while (queue.length > 0) {
    const pid = queue.shift() as string
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
      const minW = l.minW ?? 1
      // Right neighbour: slide it to the pusher's right edge and clamp its width to
      // the columns left over. Left neighbour: trim its right edge back to the
      // pusher's left edge. If the surviving width drops below minW it can't share
      // the row, so evict it just below the pusher and let it reflow what's there.
      const onRight = l.x + l.w / 2 >= p.x + p.w / 2
      if (onRight) {
        const x = pRight
        const w = Math.min(l.w, cols - x)
        if (w >= minW) { l.x = x; l.w = w; continue }
      } else {
        const w = p.x - l.x
        if (w >= minW) { l.w = w; continue }
      }
      l.y = pBottom
      queue.push(l.i)
    }
  }
  return [...map.values()]
}

// True when two layouts place the same widgets at the same x/y/w/h. Used to
// skip redundant state writes so the grid's onLayoutChange -> setState -> grid
// re-derive cycle can't ping-pong into "Maximum update depth exceeded".
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
