"use client"

import { useState } from "react"
import { Settings2, Check } from "lucide-react"
import { StatCard } from "@/components/dashboard/StatCard"
import { getRiskLevel } from "@/lib/risk"
import { Users, Bell, Database, ShieldAlert } from "lucide-react"
import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { useDashboardEditing } from "@/contexts/DashboardEditContext"
import { cn } from "@/lib/utils"

type CardKey = "employees" | "alerts" | "detections" | "risk"

const CARDS: { key: CardKey; label: string }[] = [
  { key: "employees",  label: "Employees at risk" },
  { key: "alerts",     label: "Active alerts" },
  { key: "detections", label: "New detections" },
  { key: "risk",       label: "Risk score" },
]

type WidgetConfig = { visibleCards: CardKey[] }

interface StatsRowProps {
  compromisedEmployees: number
  totalEmployees: number
  openAlerts: number
  recentBreaches: number
  riskScore: number
}

export function StatsRow({
  compromisedEmployees,
  totalEmployees,
  openAlerts,
  recentBreaches,
  riskScore,
}: StatsRowProps) {
  const editing = useDashboardEditing()
  const [config, setConfig] = useWidgetConfig<WidgetConfig>("stats-row", {
    visibleCards: ["employees", "alerts", "detections", "risk"],
  })
  const [showSettings, setShowSettings] = useState(false)
  const risk = getRiskLevel(riskScore)

  const toggle = (key: CardKey) => {
    const visible = config.visibleCards.includes(key)
    if (visible && config.visibleCards.length === 1) return
    setConfig({
      visibleCards: visible
        ? config.visibleCards.filter((k) => k !== key)
        : [...config.visibleCards, key],
    })
  }

  const cards = [
    {
      key: "employees" as CardKey,
      label: "Employees at risk",
      value: compromisedEmployees,
      description: `out of ${totalEmployees} monitored`,
      icon: Users,
      variant: (compromisedEmployees > 0 ? "critical" : "ok") as "critical" | "ok",
    },
    {
      key: "alerts" as CardKey,
      label: "Active alerts",
      value: openAlerts,
      description: "requiring attention",
      icon: Bell,
      variant: (openAlerts > 0 ? "high" : "ok") as "high" | "ok",
    },
    {
      key: "detections" as CardKey,
      label: "New detections",
      value: recentBreaches,
      description: "in the last 30 days",
      icon: Database,
      variant: (recentBreaches > 0 ? "medium" : "ok") as "medium" | "ok",
    },
    {
      key: "risk" as CardKey,
      label: "Risk score",
      value: `${riskScore} / 100`,
      description: risk.label,
      icon: ShieldAlert,
      variant: risk.variant,
    },
  ]

  const visible = cards.filter((c) => config.visibleCards.includes(c.key))
  const cols = Math.max(1, visible.length)

  return (
    <div className="relative space-y-3">
      {editing && <div className="flex justify-end">
        <button
          onClick={() => setShowSettings((s) => !s)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {showSettings ? <Check className="size-4" /> : <Settings2 className="size-4" />}
        </button>
      </div>}

      {showSettings && (
        // Floating popover: kept out of flow so opening it never grows the
        // widget past its grid cell (which would clip the top and overlap the
        // row below). The parent item's hover z-index lifts it over neighbours.
        <div className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-border bg-card p-4 shadow-lg">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Visible cards
          </p>
          <div className="flex flex-wrap gap-2">
            {CARDS.map(({ key, label }) => {
              const active = config.visibleCards.includes(key)
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {visible.map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>
    </div>
  )
}
