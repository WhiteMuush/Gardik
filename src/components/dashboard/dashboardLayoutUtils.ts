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

// Pick the widget a dragged item should fully swap with (position + size), or
// null when it covers no other widget or the exchange would break either side's
// min size. `pool` is the pre-drag layout: during a swap drag every other widget
// stays where it began (the swap compactor never pushes them), so the pool also
// gives the target's real slot.
export function findSwapTarget<T extends SwapItem>(dragged: SwapItem, pool: T[]): T | null {
  const origin = pool.find((l) => l.i === dragged.i)
  if (!origin) return null
  const cx = dragged.x + dragged.w / 2
  const cy = dragged.y + dragged.h / 2
  const target = pool.find(
    (l) =>
      l.i !== dragged.i &&
      cx >= l.x && cx < l.x + l.w &&
      cy >= l.y && cy < l.y + l.h,
  )
  if (!target) return null
  const fits =
    target.w >= (origin.minW ?? 1) && target.h >= (origin.minH ?? 1) &&
    origin.w >= (target.minW ?? 1) && origin.h >= (target.minH ?? 1)
  return fits ? target : null
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
