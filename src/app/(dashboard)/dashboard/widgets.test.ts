import { describe, it, expect } from "vitest"
import type { ApiProvider } from "@prisma/client"
import type { ReactElement } from "react"
import { defaultWidgets } from "./default-widgets"
import { libraryWidgets } from "./library-widgets"
import type { WidgetContext } from "./widget-context"

const now = new Date()
// One breach added by hand (no source) and one reported by a provider that is no longer connected.
const partial: Partial<WidgetContext["data"]> = {
  breachRecordsRaw: [
    { detectedAt: now, exposedData: ["email"], sources: [] },
    { detectedAt: now, exposedData: ["password"], sources: ["LEAKCHECK"] },
  ],
  breachCatalog: [
    {
      id: "b1",
      name: "Manual",
      source: "MANUAL",
      breachDate: now,
      dataTypes: ["email"],
      records: [{ employeeId: "e1", sources: [] }],
    },
    {
      id: "b2",
      name: "Leak",
      source: "DARK_WEB",
      breachDate: now,
      dataTypes: ["password"],
      records: [{ employeeId: "e2", sources: ["LEAKCHECK"] }],
    },
  ],
}
const data = partial as WidgetContext["data"]

function widgetData(id: string, source?: ApiProvider): unknown[] {
  const ctx = { data, sourceFor: () => source }
  const widget = [...defaultWidgets(ctx), ...libraryWidgets(ctx)].find((w) => w.instanceId === id)
  return (widget?.content as ReactElement<{ data: unknown[] }>).props.data
}

describe("breach widgets", () => {
  it("count every breach, manual and from a disconnected provider, like the counters", () => {
    const months = widgetData("trend-chart") as { count: number }[]
    expect(months.reduce((sum, m) => sum + m.count, 0)).toBe(2)
    for (const id of ["breach-sources", "breach-source-donut", "breach-timeline", "top-breaches"]) {
      expect(widgetData(id)).toHaveLength(2)
    }
    for (const id of ["data-type-breakdown", "data-type-radar"]) {
      expect(widgetData(id)).toHaveLength(2)
    }
  })

  it("still narrow to the source a widget has chosen", () => {
    expect(widgetData("breach-sources", "LEAKCHECK")).toHaveLength(1)
    expect(widgetData("data-type-breakdown", "LEAKCHECK")).toEqual([
      { type: "password", count: 1, percentage: 100 },
    ])
  })
})
