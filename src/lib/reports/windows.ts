import type { ReportFilters } from "./filters"

const DAY = 24 * 60 * 60 * 1000

export type Window = { curStart: Date; curEnd: Date; prevStart: Date; prevEnd: Date; label: string }

// A date range is compared with the equal window before it, otherwise the last 30 days with the 30 before.
export function windows(f: ReportFilters): Window {
  if (f.from && f.to) {
    const curStart = new Date(`${f.from}T00:00:00.000`)
    const curEnd = new Date(`${f.to}T23:59:59.999`)
    const len = curEnd.getTime() - curStart.getTime()
    return {
      curStart,
      curEnd,
      prevStart: new Date(curStart.getTime() - len),
      prevEnd: curStart,
      label: "vs previous period",
    }
  }
  const now = new Date()
  const curStart = new Date(now.getTime() - 30 * DAY)
  return {
    curStart,
    curEnd: now,
    prevStart: new Date(now.getTime() - 60 * DAY),
    prevEnd: curStart,
    label: "in last 30 days",
  }
}
