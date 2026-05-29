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
  Settings,
  Shield,
  LogOut,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  companyName: string
  userEmail: string
}

export function Sidebar({ companyName, userEmail }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-12 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary/15">
          <Shield className="size-4 text-sidebar-primary" />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">
          DataShield
        </span>
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
