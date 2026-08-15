"use client"

import { usePathname } from "next/navigation"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/register": "Exposure Register",
  "/data-sources": "Data Sources",
  "/data-api": "Data API",
  "/security": "My account",
}

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  const match = Object.keys(pageTitles).find((k) => pathname.startsWith(k + "/"))
  return match ? pageTitles[match] : "DataShield"
}

export function Topbar() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-6">
      <h1 className="text-sm font-medium text-foreground">{title}</h1>
    </header>
  )
}
