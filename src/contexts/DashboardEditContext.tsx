"use client"

import { createContext, useContext } from "react"

export const DashboardEditContext = createContext(false)

export function useDashboardEditing() {
  return useContext(DashboardEditContext)
}
