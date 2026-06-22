"use client"

import { usePathname } from "next/navigation"
import { PanelLeft } from "lucide-react"
import { useSidebar } from "./SidebarContext"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/alerts": "Alerts",
  "/reports": "Reports",
  "/register": "Exposure Register",
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
  const { open, toggle } = useSidebar()

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-6">
      {!open && (
        <button
          onClick={toggle}
          className="-ml-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <PanelLeft className="size-4" />
        </button>
      )}
      <h1 className="text-sm font-medium text-foreground">{title}</h1>
    </header>
  )
}
