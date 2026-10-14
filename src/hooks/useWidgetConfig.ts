"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

// A save fires no storage event in its own tab, so readers of the key are notified by hand.
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function useWidgetConfig<T>(widgetId: string, defaultValue: T): [T, (value: T) => void] {
  const key = `gardik-widget-${widgetId}`
  // Pins the first fallback, since callers pass a fresh literal each render.
  const [fallback] = useState(defaultValue)
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null
  )

  const config = useMemo(() => {
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }, [raw, fallback])

  const save = (value: T) => {
    localStorage.setItem(key, JSON.stringify(value))
    listeners.forEach((notify) => notify())
  }

  return [config, save]
}
