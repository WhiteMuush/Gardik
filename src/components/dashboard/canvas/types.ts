import type { ReactNode } from "react"
import type { GridItemLayout } from "@/types/dashboard"

export const COLS = 12

export type SourceOption = { id: string; label: string }

export type WidgetEntry = {
  instanceId: string
  type: string
  defaultTitle: string
  content: ReactNode
  defaultSize: { w: number; h: number }
  defaultPosition?: { x: number; y: number }
  minSize: { w: number; h: number }
  centerContent?: boolean
  defaultVisible?: boolean
}

export type RglItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  moved?: boolean
}

// RGL reads the controlled layout prop; unplaced widgets get y: Infinity so compaction drops them into free space.
export function buildRglLayout(
  visibleWidgets: WidgetEntry[],
  layout: GridItemLayout[],
  extraRows: Record<string, number>
): RglItem[] {
  return visibleWidgets.map((w) => {
    // Never static: a static item skips compaction, so newly added widgets would overlap.
    const base = layout.find((l) => l.i === w.instanceId) ?? {
      i: w.instanceId,
      x: 0,
      y: Infinity,
      w: w.defaultSize.w,
      h: w.defaultSize.h,
      minW: w.minSize.w,
      minH: w.minSize.h,
    }
    const extra = extraRows[w.instanceId] ?? 0
    return extra ? { ...base, h: base.h + extra } : base
  })
}

// One-column layout for narrow screens: widgets keep their height and follow reading order, top to bottom then left to right.
export function stackLayout(layout: RglItem[]): RglItem[] {
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x)
  let y = 0
  return ordered.map((l) => {
    const item = { ...l, x: 0, y, w: 1, minW: 1 }
    y += l.h
    return item
  })
}
