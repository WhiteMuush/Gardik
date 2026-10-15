import type { ReactNode } from "react"

export const STORAGE_KEY = "gardik:reports:layout:v5"
export const COLS = 12
const ROW_H = 50
const MARGIN_Y = 16
export const DEFAULT_H = 5
export const MIN_W = 3
export const MIN_H = 3

// Rows needed to show `px` without clipping, since row n spans n*ROW_H + (n-1)*MARGIN_Y.
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

// Packs rows by their tallest tile so nothing overlaps; `heightFor` seeds measured heights on Reset.
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

// Safe on the server, since saved state only reaches the DOM after the client measures or a click.
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

// Only visible sections render, so one without a saved position flows into free space (y: Infinity).
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
    // Content-fit floor on height only, since width reflows and stays resizable down to MIN_W.
    const floorH = Math.max(MIN_H, minHeights[s.id] ?? MIN_H)
    // h stays as stored, or RGL keeps echoing the difference through onLayoutChange.
    return { ...base, minH: floorH, minW: MIN_W }
  })
}

// Bails out when nothing moved, or the onLayoutChange cycle never settles.
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
