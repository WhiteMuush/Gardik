// Normalize a data-type label to lowercase snake_case.
export function normalizeType(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, "_")
}

// Parse a breach date; returns epoch (1970) when missing or invalid.
export function parseBreachDate(raw?: string | null): Date {
  if (!raw) return new Date(0)
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
