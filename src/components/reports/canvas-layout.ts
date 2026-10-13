import type { ReactNode } from "react"

export const STORAGE_KEY = "gardik:reports:layout:v5"
export const COLS = 12
const ROW_H = 50
const MARGIN_Y = 16
export const DEFAULT_H = 5
export const MIN_W = 3
export const MIN_H = 3

// Rows needed to show `px` of content without clipping (RGL cells are fixed
// height: row n spans n*ROW_H + (n-1)*MARGIN_Y).
export function rowsForPx(px: number): number {
  return Math.max(MIN_H, Math.ceil((px + MARGIN_Y) / (ROW_H + MARGIN_Y)))
}

export type Span = 4 | 6 | 12

export type ReportSectionEntry = {
  id: string
  title: string
  content: ReactNode
  defaultSpan?: Span
}

export type RglItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }
export type Saved = { layout: RglItem[]; hidden: string[] }

// Pack sections into 12-col rows for the first-run / reset layout. Each row
// advances by the tallest tile in that row (not a fixed DEFAULT_H), so tiles
// whose content needs more than DEFAULT_H rows never overlap the next row.
// `heightFor` lets the caller seed already-measured content heights (Reset),
// avoiding a collapse-to-default then regrow flicker.
export function buildDefaultLayout(
  sections: ReportSectionEntry[],
  heightFor?: (id: string) => number | undefined
): RglItem[] {
  let x = 0
  let y = 0
  let rowH = 0
  const out: RglItem[] = []
  for (const s of sections) {
    const w = s.defaultSpan ?? 12
    const h = Math.max(MIN_H, heightFor?.(s.id) ?? DEFAULT_H)
    if (x + w > COLS) {
      x = 0
      y += rowH
      rowH = 0
    }
    out.push({ i: s.id, x, y, w, h, minW: MIN_W, minH: MIN_H })
    x += w
    rowH = Math.max(rowH, h)
    if (x >= COLS) {
      x = 0
      y += rowH
      rowH = 0
    }
  }
  return out
}

// Runs during the first render, on the server too. That cannot cause a
// hydration mismatch because layout and hidden only reach the DOM through the
// grid, which waits for the client-measured containerW, and through the
// sections menu, which opens on click.
export function readSaved(sections: ReportSectionEntry[]): Saved {
  const fallback = { layout: buildDefaultLayout(sections), hidden: [] }
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved: Saved = JSON.parse(raw)
    const ids = new Set(sections.map((s) => s.id))
    let layout = fallback.layout
    if (saved.layout?.length) {
      const known = saved.layout.filter((l) => ids.has(l.i))
      const missing = sections
        .filter((s) => !known.some((l) => l.i === s.id))
        .map((s) => ({
          i: s.id,
          x: 0,
          y: Infinity,
          w: s.defaultSpan ?? 12,
          h: DEFAULT_H,
          minW: MIN_W,
          minH: MIN_H,
        }))
      layout = [...known, ...missing]
    }
    return { layout, hidden: (saved.hidden ?? []).filter((id) => ids.has(id)) }
  } catch {
    return fallback
  }
}

// Controlled layout for the grid; only visible sections are rendered, so a
// section with no saved position flows into free space (y: Infinity).
export function gridLayout(
  visibleSections: ReportSectionEntry[],
  layout: RglItem[],
  minHeights: Record<string, number>
): RglItem[] {
  return visibleSections.map((s) => {
    const base = layout.find((l) => l.i === s.id) ?? {
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
    // h comes straight from layout state (fitHeights keeps it at the content
    // floor); do not override it here, or the rendered h differs from stored h
    // and RGL keeps echoing the difference back through onLayoutChange.
    return { ...base, minH: floorH, minW: MIN_W }
  })
}

// RGL fires onLayoutChange on every layout-prop change (which we recreate each
// render). It must bail out when nothing actually moved/resized, otherwise the
// setLayout -> re-render -> new layout prop -> onLayoutChange cycle never
// settles (Maximum update depth exceeded).
export function sameLayout(current: RglItem[], layout: RglItem[]): boolean {
  const prevById = new Map(layout.map((l) => [l.i, l]))
  return (
    current.length > 0 &&
    current.every((c) => {
      const p = prevById.get(c.i)
      return p && p.x === c.x && p.y === c.y && p.w === c.w && p.h === c.h
    })
  )
}
