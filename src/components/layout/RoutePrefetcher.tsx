"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Main routes warmed in the background after first paint so later
// navigation is instant. Keep in sync with the sidebar nav.
const ROUTES = [
  "/dashboard",
  "/employees",
  "/alerts",
  "/reports",
  "/data-sources",
  "/data-api",
]

export function RoutePrefetcher() {
  const router = useRouter()

  useEffect(() => {
    const run = () => ROUTES.forEach((route) => router.prefetch(route))
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(run)
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 200)
    return () => clearTimeout(id)
  }, [router])

  return null
}
