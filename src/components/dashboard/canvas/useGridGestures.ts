"use client"

import { useMemo, useRef, useState } from "react"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verticalCompactor } = require("react-grid-layout")
import type { DashboardPreset, GridItemLayout, WidgetMeta } from "@/types/dashboard"
import { findSwapTarget, sameGeometry, squeezeResize } from "../dashboardLayoutUtils"
import { COLS, type RglItem } from "./types"

type Args = {
  layout: GridItemLayout[]
  setLayout: (layout: GridItemLayout[]) => void
  editing: boolean
  activePreset: DashboardPreset | null
  meta: WidgetMeta[]
  persistPreset: (id: string, layout: GridItemLayout[], meta: WidgetMeta[]) => void
  extraRows: Record<string, number>
}

// Drag-to-swap and squeeze-resize, rebuilt from layouts frozen at gesture start so previews never oscillate.
export function useGridGestures({
  layout,
  setLayout,
  editing,
  activePreset,
  meta,
  persistPreset,
  extraRows,
}: Args) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null)
  const preDragLayout = useRef<RglItem[]>([])
  // A ref, because the drop handler runs after the draggingId state is already cleared.
  const draggedId = useRef<string | null>(null)
  const preResizeLayout = useRef<RglItem[]>([])
  const resizingId = useRef<string | null>(null)

  // Saves only in Customize mode and merges back hidden widgets' slots, so hiding one never loses its place.
  const commitLayout = (items: RglItem[]) => {
    const next = items.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
    }))
    if (sameGeometry(next, layout)) return
    setLayout(next)
    if (!editing || !activePreset) return
    const savedLayout = activePreset.layout ?? []
    const visibleIds = new Set(next.map((l) => l.i))
    const preserved = savedLayout.filter((l) => !visibleIds.has(l.i))
    persistPreset(activePreset.id, [...next, ...preserved], meta)
  }

  // Writes only on drop, never via onLayoutChange, whose compaction echoes loop into "Maximum update depth".
  const onDragStop = (item: RglItem | null) => {
    setDraggingId(null)
    setSwapTargetId(null)
    const pre = preDragLayout.current
    const id = draggedId.current
    preDragLayout.current = []
    draggedId.current = null
    if (Object.keys(extraRows).length > 0 || pre.length === 0 || !id || !item) return
    const origin = pre.find((l) => l.i === id)
    const target = findSwapTarget(item, pre)
    // Swapped widgets exchange slot and size, clamped to their own minimum so a reload does not regrow them.
    const base =
      target && origin
        ? pre.map((l) => {
            if (l.i === id)
              return {
                ...l,
                x: target.x,
                y: target.y,
                w: Math.max(target.w, l.minW ?? 1),
                h: Math.max(target.h, l.minH ?? 1),
              }
            if (l.i === target.i)
              return {
                ...l,
                x: origin.x,
                y: origin.y,
                w: Math.max(origin.w, l.minW ?? 1),
                h: Math.max(origin.h, l.minH ?? 1),
              }
            return l
          })
        : pre.map((l) => (l.i === id ? { ...l, x: item.x, y: item.y } : l))
    commitLayout(verticalCompactor.compact(base, COLS))
  }

  const onResizeStop = (finalLayout: RglItem[]) => {
    const id = resizingId.current
    const pre = preResizeLayout.current
    resizingId.current = null
    preResizeLayout.current = []
    if (Object.keys(extraRows).length > 0) return
    if (id && pre.length > 0) {
      commitLayout(verticalCompactor.compact(squeezeResize(finalLayout, id, COLS, pre), COLS))
      return
    }
    commitLayout(finalLayout)
  }

  // Pins every widget but the dragged one to its frozen slot; allowOverlap stays false or the layout thrashes.
  const compactor = useMemo(
    () => ({
      type: "vertical" as const,
      allowOverlap: false,
      compact(items: RglItem[], cols: number) {
        const rid = resizingId.current
        const preR = preResizeLayout.current
        if (rid && preR.length > 0) {
          return verticalCompactor.compact(squeezeResize(items, rid, cols, preR), cols)
        }
        const pre = preDragLayout.current
        const id = draggedId.current
        if (!id || pre.length === 0) return verticalCompactor.compact(items, cols)
        // Matched by id, since collision resolution marks pushed neighbours as moved too.
        const dragged = items.find((l) => l.i === id)
        if (!dragged) return verticalCompactor.compact(items, cols)
        return pre.map((l) => (l.i === id ? { ...l, x: dragged.x, y: dragged.y } : { ...l }))
      },
    }),
    []
  )

  return {
    draggingId,
    swapTargetId,
    compactor,
    onDragStart: (currentLayout: RglItem[], oldItem: RglItem | null) => {
      preDragLayout.current = currentLayout.map((l) => ({ ...l }))
      draggedId.current = oldItem?.i ?? null
      setDraggingId(oldItem?.i ?? null)
    },
    onDrag: (_layout: RglItem[], _oldItem: RglItem | null, item: RglItem | null) => {
      setSwapTargetId(item ? (findSwapTarget(item, preDragLayout.current)?.i ?? null) : null)
    },
    onDragStop: (_finalLayout: RglItem[], _oldItem: RglItem | null, item: RglItem | null) => onDragStop(item),
    onResizeStart: (currentLayout: RglItem[], oldItem: RglItem | null) => {
      preResizeLayout.current = currentLayout.map((l) => ({ ...l }))
      resizingId.current = oldItem?.i ?? null
    },
    onResizeStop: (finalLayout: RglItem[]) => onResizeStop(finalLayout),
  }
}
