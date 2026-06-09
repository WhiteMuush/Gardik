"use client"

import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/data-sources": "Data Sources",
  "/data-api": "Data API",
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
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
      <h1 className="text-sm font-medium text-foreground">{title}</h1>
      <div className="flex items-center gap-1">
        <button className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="size-4" />
        </button>
      </div>
    </header>
  )
}
