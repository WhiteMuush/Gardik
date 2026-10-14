// Non-sensitive hint shown in the UI: only the last 4 characters.
export function keyHint(key: string): string {
  return `****${key.slice(-4)}`
}

const MAX_RATE_PER_MINUTE = 100_000

// A whole number of requests per minute, or null to go back to the provider default.
export function parseRateLimit(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null) return { ok: true, value: null }
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_RATE_PER_MINUTE) {
    return { ok: true, value }
  }
  return { ok: false }
}
