"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

// A save in this tab does not fire the storage event, so readers of the same
// key are notified by hand; the event still covers other tabs.
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
  // Callers pass a fresh literal on every render. Pinning the first one keeps
  // config referentially stable while nothing is saved.
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
