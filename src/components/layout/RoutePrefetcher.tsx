"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Main routes warmed in the background after first paint so later navigation
// is instant. Kept in sync with the sidebar nav, and filtered by the same
// server-resolved list the rail uses: warming a page that will answer
// "not available to your role" spends a request to cache a refusal.
const ROUTES = [
  "/dashboard",
  "/employees",
  "/alerts",
  "/reports",
  "/data-sources",
  "/data-api",
]

export function RoutePrefetcher({ visible }: { visible: string[] }) {
  const router = useRouter()
  // The prop is a fresh array on every render, so depending on it directly
  // would re-run the warm-up on each navigation instead of once after first
  // paint. Its contents are what matter, and they only change with the role.
  const key = visible.join(",")

  useEffect(() => {
    const run = () =>
      ROUTES.filter((route) => key.split(",").includes(route)).forEach((route) =>
        router.prefetch(route)
      )
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(run)
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 200)
    return () => clearTimeout(id)
  }, [router, key])

  return null
}
