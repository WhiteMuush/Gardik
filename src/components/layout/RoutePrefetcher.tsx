"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Warmed after first paint and filtered like the rail, so no request is spent caching a refusal.
const ROUTES = ["/dashboard", "/employees", "/alerts", "/reports", "/data-sources", "/data-api"]

export function RoutePrefetcher({ visible }: { visible: string[] }) {
  const router = useRouter()
  // Keyed on contents, since the prop is a fresh array each render and only changes with the role.
  const key = visible.join(",")

  useEffect(() => {
    const run = () =>
      ROUTES.filter((route) => key.split(",").includes(route)).forEach((route) => router.prefetch(route))
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(run)
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 200)
    return () => clearTimeout(id)
  }, [router, key])

  return null
}
