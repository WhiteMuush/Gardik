import { sleep } from "./normalize"

export type Pace = () => Promise<void>

// Keeps one source under `ratePerMinute`, and each source has its own pacer so a slow plan slows no other.
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
