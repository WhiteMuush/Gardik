"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "@/lib/auth/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Bell,
  FileText,
  ScrollText,
  Database,
  KeyRound,
  Send,
  LogOut,
  Lock,
  ShieldCheck,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/register", label: "Exposure Register", icon: ScrollText },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/data-api", label: "Data API", icon: KeyRound },
  { href: "/notifications", label: "Notifications", icon: Send },
  { href: "/access", label: "Access", icon: ShieldCheck },
  { href: "/security", label: "Security", icon: Lock },
]

// Layers (within the aside stacking context): labels z-10 sit UNDER the rail
// surface z-20, icons/pills z-30 sit ABOVE it. A label starts tucked behind the
// surface and slides right on hover, so it emerges from under the panel.
function RailLabel({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-10 -ml-4 -translate-y-1/2">
      <span className="block -translate-x-full whitespace-nowrap rounded-md border border-border bg-popover py-2.5 pl-11 pr-5 text-sm font-medium text-popover-foreground transition-transform duration-500 ease-[cubic-bezier(0.36,0,0.66,-0.56)] group-hover/item:translate-x-0 group-hover/item:duration-150 group-hover/item:ease-out">
        {children}
      </span>
    </span>
  )
}

interface SidebarProps {
  openAlerts: number
}

export function Sidebar({ openAlerts }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-screen w-16 flex-col">
      {/* Rail shadow: painted BELOW the labels so it never tints them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 shadow-[4px_0_24px_-6px_oklch(var(--primary)/0.18)]"
      />
      {/* Rail surface: opaque, painted ABOVE the labels so they hide under it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 border-r border-sidebar-border bg-sidebar"
      />

      <div className="relative z-30 flex h-12 items-center justify-center border-b border-sidebar-border">
        <ShieldCheck className="size-5 text-sidebar-primary" />
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/")
          return (
            <Link key={href} href={href} className="group/item relative flex">
              <span
                className={cn(
                  "relative z-30 flex w-full items-center justify-center rounded-md py-2.5 transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/60 group-hover/item:bg-sidebar-accent/50 group-hover/item:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {href === "/alerts" && openAlerts > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-severity-critical px-1 text-[10px] font-medium leading-4 tabular-nums text-white">
                    {openAlerts > 9 ? "9+" : openAlerts}
                  </span>
                )}
              </span>
              <RailLabel>{label}</RailLabel>
            </Link>
          )
        })}
      </nav>

      <div className="relative px-2 py-3">
        <div
          aria-hidden
          className="absolute inset-x-2 top-0 z-30 border-t border-sidebar-border"
        />
        <button
          onClick={() =>
            signOut({
              fetchOptions: { onSuccess: () => router.push("/login") },
            })
          }
          className="group/item relative flex w-full"
        >
          <span className="relative z-30 flex w-full items-center justify-center rounded-md py-2.5 text-sidebar-foreground/60 transition-colors group-hover/item:bg-sidebar-accent/50 group-hover/item:text-sidebar-foreground">
            <LogOut className="size-4 shrink-0" />
          </span>
          <RailLabel>Sign out</RailLabel>
        </button>
      </div>
    </aside>
  )
}
