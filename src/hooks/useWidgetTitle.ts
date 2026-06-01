"use client"

import { useDashboardConfig } from "@/contexts/DashboardConfigContext"

export function useWidgetTitle(instanceId: string, defaultTitle: string) {
  const { getTitle, setTitle, editing } = useDashboardConfig()
  return {
    title: getTitle(instanceId, defaultTitle),
    setTitle: (t: string) => setTitle(instanceId, t),
    editing,
  }
}
