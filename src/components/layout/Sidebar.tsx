"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Bell,
  FileText,
  Database,
  KeyRound,
  LogOut,
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

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-12 items-center border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold text-sidebar-foreground">DataShield</span>
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
