"use client"

import { createContext, useContext } from "react"

type DashboardConfigContextValue = {
  getTitle: (instanceId: string, defaultTitle: string) => string
  setTitle: (instanceId: string, title: string) => void
  editing: boolean
}

export const DashboardConfigContext = createContext<DashboardConfigContextValue>({
  getTitle: (_, d) => d,
  setTitle: () => {},
  editing: false,
})

export function useDashboardConfig() {
  return useContext(DashboardConfigContext)
}
