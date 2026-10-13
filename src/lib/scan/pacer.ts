import { sleep } from "./normalize"

export type Pace = () => Promise<void>

// Spaces calls to one source so it never sees more than `ratePerMinute`.
// Each source gets its own pacer, so a slow plan never slows the others down.
export function createPacer(ratePerMinute: number, now: () => number = Date.now): Pace {
  const interval = 60_000 / Math.max(1, ratePerMinute)
  let next = 0
  return async () => {
    const t = now()
    const slot = Math.max(t, next)
    next = slot + interval
    if (slot > t) await sleep(slot - t)
  }
}
