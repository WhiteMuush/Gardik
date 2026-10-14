import type { ApiProvider } from "@prisma/client"
import type { getDashboardData } from "@/lib/dashboard"

// What every widget factory needs: the dashboard data and each widget's chosen source.
export type WidgetContext = {
  data: Awaited<ReturnType<typeof getDashboardData>>
  sourceFor: (instanceId: string) => ApiProvider | undefined
}
