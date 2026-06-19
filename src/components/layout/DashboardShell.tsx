"use client"

import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { SidebarProvider } from "./SidebarContext"

interface DashboardShellProps {
  companyName: string
  userEmail: string
  openAlerts: number
  children: ReactNode
}

function Shell({ companyName, userEmail, openAlerts, children }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar companyName={companyName} userEmail={userEmail} openAlerts={openAlerts} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <SidebarProvider>
      <Shell {...props} />
    </SidebarProvider>
  )
}
