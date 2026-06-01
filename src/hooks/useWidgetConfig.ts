"use client"

import { useState, useEffect } from "react"

export function useWidgetConfig<T>(widgetId: string, defaultValue: T): [T, (value: T) => void] {
  const key = `datashield-widget-${widgetId}`
  const [config, setConfig] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) setConfig(JSON.parse(saved))
    } catch {}
  }, [key])

  const save = (value: T) => {
    setConfig(value)
    localStorage.setItem(key, JSON.stringify(value))
  }

  return [config, save]
}
