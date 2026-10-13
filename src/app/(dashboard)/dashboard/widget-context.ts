import type { ApiProvider } from "@prisma/client"
import type { getDashboardData } from "@/lib/dashboard"
import type { BreachCatalogEntry, BreachRecordRaw } from "@/lib/dashboard-series"

// What every widget factory needs: the dashboard data, the breach data gated to connected sources, and each widget's chosen source.
export type WidgetContext = {
  data: Awaited<ReturnType<typeof getDashboardData>>
  gatedRecords: BreachRecordRaw[]
  gatedCatalog: BreachCatalogEntry[]
  sourceFor: (instanceId: string) => ApiProvider | undefined
}
