"use client"

import { createContext, useContext } from "react"

type DashboardConfigContextValue = {
  getTitle: (instanceId: string, defaultTitle: string) => string
  setTitle: (instanceId: string, title: string) => void
  editing: boolean
  // Lets a widget grow its cell by `rows` (0 collapses) while an in-widget editor is open.
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
