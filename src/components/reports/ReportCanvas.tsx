"use client"

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ResponsiveGridLayout, verticalCompactor } = require("react-grid-layout")
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { Settings2, Check, GripHorizontal, Eye, EyeOff, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "datashield:reports:layout:v5"
const COLS = 12
const ROW_H = 50
const MARGIN_Y = 16
const DEFAULT_H = 5
const MIN_W = 3
const MIN_H = 3

// Rows needed to show `px` of content without clipping (RGL cells are fixed
// height: row n spans n*ROW_H + (n-1)*MARGIN_Y).
function rowsForPx(px: number): number {
  return Math.max(MIN_H, Math.ceil((px + MARGIN_Y) / (ROW_H + MARGIN_Y)))
}

export type Span = 4 | 6 | 12

export type ReportSectionEntry = {
  id: string
  title: string
  content: ReactNode
  defaultSpan?: Span
}

type RglItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }
type Saved = { layout: RglItem[]; hidden: string[] }

// Pack sections into 12-col rows for the first-run layout.
function buildDefaultLayout(sections: ReportSectionEntry[]): RglItem[] {
  let x = 0
  let y = 0
  const out: RglItem[] = []
  for (const s of sections) {
    const w = s.defaultSpan ?? 12
    if (x + w > COLS) {
      x = 0
      y += DEFAULT_H
    }
    out.push({ i: s.id, x, y, w, h: DEFAULT_H, minW: MIN_W, minH: MIN_H })
    x += w
    if (x >= COLS) {
      x = 0
      y += DEFAULT_H
    }
  }
  return out
}

export function ReportCanvas({ sections }: { sections: ReportSectionEntry[] }) {
  const [editing, setEditing] = useState(false)
  const [containerW, setContainerW] = useState(0)
  const [layout, setLayout] = useState<RglItem[]>(() => buildDefaultLayout(sections))
  const [hidden, setHidden] = useState<string[]>([])
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false)
  const [minHeights, setMinHeights] = useState<Record<string, number>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const contentEls = useRef(new Map<string, HTMLDivElement>())

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved: Saved = JSON.parse(raw)
      const ids = new Set(sections.map((s) => s.id))
      if (saved.layout?.length) {
        const known = saved.layout.filter((l) => ids.has(l.i))
        const missing = sections
          .filter((s) => !known.some((l) => l.i === s.id))
          .map((s) => ({ i: s.id, x: 0, y: Infinity, w: s.defaultSpan ?? 12, h: DEFAULT_H, minW: MIN_W, minH: MIN_H }))
        setLayout([...known, ...missing])
      }
      setHidden((saved.hidden ?? []).filter((id) => ids.has(id)))
    } catch {
      /* ignore corrupt storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Round and dedupe: contentRect.width is fractional and jitters by
    // sub-pixels as tiles auto-fit, and containerW is a dependency of the
    // fitHeights effect. An unrounded value changes every render and feeds an
    // endless update loop (Maximum update depth exceeded).
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width)
      setContainerW((prev) => (prev === w ? prev : w))
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

  useEffect(() => {
    const ro = new ResizeObserver(() => fitHeights())
    // Observe the intrinsic probe, not the cell-sized node: the cell height is
    // driven by fitHeights, so observing it would feed an infinite loop.
    contentEls.current.forEach((node) => {
      const probe = node.querySelector("[data-measure]")
      if (probe) ro.observe(probe)
    })
    fitHeights()
    return () => ro.disconnect()
  }, [fitHeights, hidden, containerW, sections.length])

  useEffect(() => {
    if (!sectionsMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setSectionsMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [sectionsMenuOpen])

  const persist = useCallback((next: Saved) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
  }, [])

  const visibleSections = sections.filter((s) => !hidden.includes(s.id))

  // Controlled layout for the grid; only visible sections are rendered, so a
  // section with no saved position flows into free space (y: Infinity).
  const rglLayout = visibleSections.map((s) => {
    const base =
      layout.find((l) => l.i === s.id) ?? {
        i: s.id,
        x: 0,
        y: Infinity,
        w: s.defaultSpan ?? 12,
        h: DEFAULT_H,
        minW: MIN_W,
        minH: MIN_H,
      }
    // Content-fit height floor blocks shrinking below what the content needs,
    // while still allowing manual grow. Width has no reliable intrinsic min
    // (content reflows), so it stays freely resizable down to MIN_W.
    const floorH = Math.max(MIN_H, minHeights[s.id] ?? MIN_H)
    return {
      ...base,
      minH: floorH,
      minW: MIN_W,
      h: Math.max(base.h, floorH),
    }
  })

  const onLayoutChange = (current: RglItem[]) => {
    // RGL fires this on every layout-prop change (which we recreate each
    // render). Bail out when nothing actually moved/resized, otherwise the
    // setLayout -> re-render -> new layout prop -> onLayoutChange cycle never
    // settles (Maximum update depth exceeded).
    const prevById = new Map(layout.map((l) => [l.i, l]))
    const unchanged =
      current.length > 0 &&
      current.every((c) => {
        const p = prevById.get(c.i)
        return p && p.x === c.x && p.y === c.y && p.w === c.w && p.h === c.h
      })
    if (unchanged) return

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
    const l = buildDefaultLayout(sections)
    setLayout(l)
    setHidden([])
    persist({ layout: l, hidden: [] })
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Toolbar */}
      <div className="no-print mb-3 flex shrink-0 items-center justify-end gap-2">
        {editing && (
          <>
            <p className="mr-auto text-xs text-muted-foreground">Drag to move, resize, toggle sections</p>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setSectionsMenuOpen((o) => !o)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Eye className="size-3.5" />
                Sections
              </button>
              {sectionsMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md">
                  {sections.map((s) => {
                    const isHidden = hidden.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleHidden(s.id)}
                        className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs hover:bg-muted"
                      >
                        {isHidden ? <EyeOff className="size-3.5 text-muted-foreground" /> : <Eye className="size-3.5 text-primary" />}
                        <span className={cn(isHidden && "text-muted-foreground")}>{s.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button
              onClick={reset}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
          </>
        )}
        {editing ? (
          <Button size="sm" onClick={() => setEditing(false)} className="gap-1.5">
            <Check className="size-3.5" />
            Done
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Settings2 className="size-3.5" />
            Customize
          </Button>
        )}
      </div>

      {/* Grid. react-grid-layout (same engine as the dashboard): drag is bounded
          to the container, vertical compaction backfills holes, and tiles keep
          their real size. Drag is limited to the explicit handle. */}
      <div ref={containerRef} className={cn("no-print", editing && "select-none [&_.react-resizable-handle]:block")}>
        {containerW > 0 && (
          <ResponsiveGridLayout
            className="layout"
            width={containerW}
            breakpoints={{ lg: 0 }}
            cols={{ lg: COLS }}
            layouts={{ lg: rglLayout }}
            rowHeight={50}
            compactor={verticalCompactor}
            dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: editing }}
            onLayoutChange={onLayoutChange}
            margin={[16, 16]}
            containerPadding={[0, 0]}
          >
            {visibleSections.map((s) => (
              <div
                key={s.id}
                className={cn("relative h-full overflow-hidden", editing && "rounded-xl outline outline-2 outline-primary/30")}
              >
                {editing && (
                  <button
                    type="button"
                    className="widget-drag-handle absolute right-2 top-2 z-30 flex cursor-grab items-center gap-1 rounded-md border border-primary/40 bg-card/95 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground active:cursor-grabbing"
                    title="Drag to move"
                  >
                    <GripHorizontal className="size-3" />
                    Move
                  </button>
                )}
                <div
                  ref={(node) => {
                    if (node) contentEls.current.set(s.id, node)
                    else contentEls.current.delete(s.id)
                  }}
                  className="h-full overflow-auto"
                >
                  {s.content}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  )
}
