"use client"

import { createContext, useContext } from "react"

type DashboardConfigContextValue = {
  getTitle: (instanceId: string, defaultTitle: string) => string
  setTitle: (instanceId: string, title: string) => void
  editing: boolean
  // A widget can ask its grid cell to grow by `rows` (0 = collapse) while an
  // in-widget editor is open, so the extra content pushes neighbours instead of
  // overflowing onto them.
  requestRows: (instanceId: string, rows: number) => void
}

export const DashboardConfigContext = createContext<DashboardConfigContextValue>({
  getTitle: (_, d) => d,
  setTitle: () => {},
  editing: false,
  requestRows: () => {},
})

export function useDashboardConfig() {
  return useContext(DashboardConfigContext)
}
