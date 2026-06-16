import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { windows } from "./windows"
import { EMPTY_FILTERS } from "./filters"

const DAY = 24 * 60 * 60 * 1000

describe("windows", () => {
  describe("explicit date range", () => {
    it("uses the range as the current window, inclusive of full end day", () => {
      const w = windows({ ...EMPTY_FILTERS, from: "2026-03-10", to: "2026-03-20" })
      expect(w.curStart).toEqual(new Date("2026-03-10T00:00:00.000"))
      expect(w.curEnd).toEqual(new Date("2026-03-20T23:59:59.999"))
      expect(w.label).toBe("vs previous period")
    })

    it("compares against the equal-length window immediately before", () => {
      const w = windows({ ...EMPTY_FILTERS, from: "2026-03-10", to: "2026-03-20" })
      const len = w.curEnd.getTime() - w.curStart.getTime()
      // Previous window ends exactly where the current one starts, no overlap.
      expect(w.prevEnd).toEqual(w.curStart)
      // and spans the same duration.
      expect(w.curStart.getTime() - w.prevStart.getTime()).toBe(len)
    })

    it("handles a single-day range", () => {
      const w = windows({ ...EMPTY_FILTERS, from: "2026-03-10", to: "2026-03-10" })
      const len = w.curEnd.getTime() - w.curStart.getTime()
      // Almost a full day (23:59:59.999).
      expect(len).toBe(DAY - 1)
      expect(w.prevStart).toEqual(new Date(w.curStart.getTime() - len))
    })
  })

  describe("no date range (trailing 30 days)", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it("current window is the last 30 days up to now", () => {
      const now = Date.now()
      const w = windows(EMPTY_FILTERS)
      expect(w.curEnd.getTime()).toBe(now)
      expect(w.curStart.getTime()).toBe(now - 30 * DAY)
      expect(w.label).toBe("in last 30 days")
    })

    it("previous window is the 30 days before the current one, contiguous", () => {
      const now = Date.now()
      const w = windows(EMPTY_FILTERS)
      expect(w.prevEnd).toEqual(w.curStart)
      expect(w.prevStart.getTime()).toBe(now - 60 * DAY)
    })

    it("falls back to trailing 30 days when only one bound is set", () => {
      expect(windows({ ...EMPTY_FILTERS, from: "2026-03-10" }).label).toBe("in last 30 days")
      expect(windows({ ...EMPTY_FILTERS, to: "2026-03-20" }).label).toBe("in last 30 days")
    })
  })
})
