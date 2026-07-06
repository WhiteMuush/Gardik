"use client"

import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"

interface DashboardShellProps {
  openAlerts: number
  children: ReactNode
}

export function DashboardShell({ openAlerts, children }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden pl-16">
      <Sidebar openAlerts={openAlerts} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
