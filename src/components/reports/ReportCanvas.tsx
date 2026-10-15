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
    // Rounded and deduped, since sub-pixel jitter in a fitHeights dependency would loop forever.
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      // Floored, since 1px too wide toggles a scrollbar that shrinks the container in a loop.
      const w = Math.floor(entry.contentRect.width)
      // Ignore sub-2px wobble so a 1px layout ping-pong cannot drive a loop.
      setContainerW((prev) => (Math.abs(prev - w) < 2 ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fits each tile to its content and records that height as the resize floor (minH).
  const fitHeights = useCallback(() => {
    const neededH = new Map<string, number>()
    contentEls.current.forEach((node, id) => {
      // Measures the natural-height probe, so a manual grow never raises the floor.
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
        // Grows and shrinks to content, loop-free because the probe is not the cell-sized node.
        if (nh !== undefined && nh !== l.h) {
          changed = true
          return { ...l, h: nh }
        }
        return l
      })
      return changed ? next : prev
    })
  }, [])

  // Re-measures on width changes only, never height, in the next frame so the auto-fit cannot loop.
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
    // Seeds measured heights so rows pack at their true height, and the nonce still forces a re-measure.
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

      {/* Same grid engine as the dashboard, with drag bounded to the container and limited to the handle. */}
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
