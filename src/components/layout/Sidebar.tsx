"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useSidebar } from "./SidebarContext"

// Auto-close the floating sidebar after this idle delay (no pointer over it).
const AUTO_CLOSE_MS = 4000
import {
  LayoutDashboard,
  Users,
  Bell,
  FileText,
  Database,
  KeyRound,
  LogOut,
  PanelLeftClose,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/data-api", label: "Data API", icon: KeyRound },
]

interface SidebarProps {
  companyName: string
  userEmail: string
  openAlerts: number
}

export function Sidebar({ companyName, userEmail, openAlerts }: SidebarProps) {
  const pathname = usePathname()
  const { open, toggle, close } = useSidebar()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const asideRef = useRef<HTMLElement>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const startTimer = () => {
    clearTimer()
    timer.current = setTimeout(close, AUTO_CLOSE_MS)
  }

  // Start the idle countdown whenever the sidebar opens; hovering pauses it.
  useEffect(() => {
    if (open) startTimer()
    else clearTimer()
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close when clicking anywhere outside the panel.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!asideRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <aside
      ref={asideRef}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar shadow-[4px_0_24px_-6px_oklch(var(--primary)/0.18)] transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold text-sidebar-foreground">DataShield</span>
        <button
          onClick={toggle}
          className="-mr-1 rounded-md p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-sidebar-primary" : ""
                )}
              />
              {label}
              {href === "/alerts" && openAlerts > 0 && (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-severity-critical px-1.5 text-xs font-medium tabular-nums text-white">
                  {openAlerts > 99 ? "99+" : openAlerts}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <div className="px-2 py-1">
          <p className="truncate text-xs font-medium text-sidebar-foreground">
            {companyName}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/50">
            {userEmail}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
