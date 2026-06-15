type Entry = { count: number; reset: number }

const buckets = new Map<string, Entry>()

// Fixed-window counter. Returns false once the limit is reached for the
// current window. In-memory and per-instance, sufficient for a single-node
// deployment; move to a shared store if the app is scaled horizontally.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}
