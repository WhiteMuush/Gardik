"use client"

import { useState, useEffect } from "react"
import { Settings2, Check } from "lucide-react"
import { StatCard } from "@/components/dashboard/StatCard"
import { getRiskLevel } from "@/lib/risk"
import { Users, Bell, Database, ShieldAlert } from "lucide-react"
import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { useDashboardEditing } from "@/contexts/DashboardEditContext"
import { useDashboardConfig } from "@/contexts/DashboardConfigContext"
import { cn } from "@/lib/utils"

// Extra grid rows the cell needs to fit the open Visible cards panel so it
// pushes neighbours instead of overflowing onto them.
const SETTINGS_EXTRA_ROWS = 2

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
  const { requestRows } = useDashboardConfig()
  const risk = getRiskLevel(riskScore)

  // Grow the grid cell while the panel is open (and on unmount / leaving edit
  // mode), so the in-flow panel pushes the rows above and below.
  const open = editing && showSettings
  useEffect(() => {
    requestRows("stats-row", open ? SETTINGS_EXTRA_ROWS : 0)
    return () => requestRows("stats-row", 0)
  }, [open, requestRows])

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
    <div className="space-y-3">
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
        <div className="rounded-lg border border-border bg-card p-4">
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
