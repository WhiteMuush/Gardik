export const VIEW_FIELDS = {
  employees: ["department", "risk", "sort"],
  alerts: ["severity", "status", "confidence"],
} as const

export type ViewPage = keyof typeof VIEW_FIELDS
export type SavedView = Record<string, string>
export type SavedViews = Partial<Record<ViewPage, SavedView>>

const MAX_VALUE_LENGTH = 100

export function isViewPage(page: string): page is ViewPage {
  return Object.hasOwn(VIEW_FIELDS, page)
}

export function parseView(
  page: ViewPage,
  body: unknown
): { ok: true; view: SavedView } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return { ok: false, error: "Invalid view" }
  const view: SavedView = {}
  for (const field of VIEW_FIELDS[page]) {
    const value = (body as Record<string, unknown>)[field]
    if (value === undefined || value === "") continue
    if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH)
      return { ok: false, error: `Invalid ${field}` }
    view[field] = value
  }
  return { ok: true, view }
}

// The column is JSON, so every page is re-validated on read rather than trusted.
export function readViews(stored: unknown): SavedViews {
  const views: SavedViews = {}
  if (typeof stored !== "object" || stored === null) return views
  for (const [page, body] of Object.entries(stored)) {
    if (!isViewPage(page)) continue
    const parsed = parseView(page, body)
    if (parsed.ok && Object.keys(parsed.view).length > 0) views[page] = parsed.view
  }
  return views
}
