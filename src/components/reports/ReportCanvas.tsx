"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  STORAGE_KEY,
  buildDefaultLayout,
  gridLayout,
  readSaved,
  rowsForPx,
  sameLayout,
  type ReportSectionEntry,
  type RglItem,
  type Saved,
} from "./canvas-layout"
import { CanvasGrid } from "./CanvasGrid"
import { CanvasToolbar } from "./CanvasToolbar"

export function ReportCanvas({ sections }: { sections: ReportSectionEntry[] }) {
  const [editing, setEditing] = useState(false)
  const [containerW, setContainerW] = useState(0)
  const [saved] = useState(() => readSaved(sections))
  const [layout, setLayout] = useState<RglItem[]>(saved.layout)
  const [hidden, setHidden] = useState<string[]>(saved.hidden)
  const [minHeights, setMinHeights] = useState<Record<string, number>>({})
  // Bumped to force a re-measure even when widths are unchanged (e.g. Reset).
  const [measureNonce, setMeasureNonce] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentEls = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Round and dedupe: contentRect.width is fractional and jitters by
    // sub-pixels as tiles auto-fit, and containerW is a dependency of the
    // fitHeights effect. An unrounded value changes every render and feeds an
    // endless update loop (Maximum update depth exceeded).
    const ro = new ResizeObserver((entries) => {
      // Floor (never round up): the grid is rendered at width=containerW, and a
      // value 1px wider than the container overflows horizontally, toggling a
      // scrollbar that shrinks the container, which feeds an endless loop.
      const w = Math.floor(entries[0].contentRect.width)
      // Ignore sub-2px wobble so a 1px layout ping-pong cannot drive a loop.
      setContainerW((prev) => (Math.abs(prev - w) < 2 ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Grow each tile to fit its content so nothing is clipped (RGL cells are
  // fixed height). Only grows: a user resize larger than the content is kept.
  // Also records each section's content-fit row count so it becomes a hard
  // resize floor (minH): the handle stops at content height, no snap-back.
  const fitHeights = useCallback(() => {
    const neededH = new Map<string, number>()
    contentEls.current.forEach((node, id) => {
      // Measure the natural-height probe, not the cell-filling node, so the
      // floor reflects the intrinsic content height and a manual grow does not
      // raise the floor (which would block shrinking back down).
      const probe = (node.querySelector("[data-measure]") as HTMLElement | null) ?? node
      neededH.set(id, rowsForPx(probe.scrollHeight))
    })
    setMinHeights((prev) => {
      let changed = false
      const next = { ...prev }
      neededH.forEach((n, id) => {
        if (next[id] !== n) {
          next[id] = n
          changed = true
        }
      })
      return changed ? next : prev
    })
    setLayout((prev) => {
      let changed = false
      const next = prev.map((l) => {
        const nh = neededH.get(l.i)
        // Height auto-fits content (grow and shrink) so there is never dead
        // space below short content. Safe from feedback loops because the
        // measurement reads the intrinsic probe, not the cell-sized node.
        if (nh !== undefined && nh !== l.h) {
          changed = true
          return { ...l, h: nh }
        }
        return l
      })
      return changed ? next : prev
    })
  }, [])

  // Content height only changes with width (container queries reflow on the
  // tile width). Re-measure when widths change, never via a continuous
  // ResizeObserver: height is intentionally NOT a dependency, so fitHeights
  // setting h cannot retrigger this effect. That makes the auto-fit
  // loop-free by construction (previous versions oscillated forever).
  // The measurement runs in the next animation frame rather than in the effect
  // body, so its state updates land as one batch before that frame paints.
  const widthSig = layout.map((l) => `${l.i}:${l.w}`).join("|")
  const hiddenSig = hidden.join(",")
  useEffect(() => {
    const frame = requestAnimationFrame(fitHeights)
    return () => cancelAnimationFrame(frame)
  }, [fitHeights, widthSig, containerW, hiddenSig, sections.length, measureNonce])

  const persist = useCallback((next: Saved) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
  }, [])

  const visibleSections = sections.filter((s) => !hidden.includes(s.id))

  const rglLayout = gridLayout(visibleSections, layout, minHeights)

  const onLayoutChange = (current: RglItem[]) => {
    if (sameLayout(current, layout)) return

    // Keep hidden sections' saved positions so toggling them back never loses placement.
    const visibleIds = new Set(current.map((l) => l.i))
    const preserved = layout.filter((l) => !visibleIds.has(l.i))
    const next = [...current.map((l) => ({ ...l })), ...preserved]
    setLayout(next)
    if (editing) persist({ layout: next, hidden })
  }

  const toggleHidden = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
      persist({ layout, hidden: next })
      return next
    })
  }

  const reset = () => {
    // Seed the default layout with the heights already measured for each
    // section so rows are packed at their true height from the start (no
    // collapse-to-DEFAULT_H then regrow, no transient overlap that RGL would
    // resolve by shoving tiles around). Keep minHeights as-is and bump the
    // nonce so fitHeights still re-measures and corrects any width-dependent
    // drift on the next frame.
    const l = buildDefaultLayout(sections, (id) => minHeights[id])
    setLayout(l)
    setHidden([])
    setMeasureNonce((n) => n + 1)
    persist({ layout: l, hidden: [] })
  }

  return (
    <div className="flex flex-1 flex-col">
      <CanvasToolbar
        sections={sections}
        hidden={hidden}
        editing={editing}
        setEditing={setEditing}
        toggleHidden={toggleHidden}
        reset={reset}
      />

      {/* Grid. react-grid-layout (same engine as the dashboard): drag is bounded
          to the container, vertical compaction backfills holes, and tiles keep
          their real size. Drag is limited to the explicit handle. */}
      <div
        ref={containerRef}
        className={cn("no-print", editing && "select-none [&_.react-resizable-handle]:block")}
      >
        {containerW > 0 && (
          <CanvasGrid
            width={containerW}
            layout={rglLayout}
            sections={visibleSections}
            editing={editing}
            onLayoutChange={onLayoutChange}
            contentEls={contentEls}
          />
        )}
      </div>
    </div>
  )
}
