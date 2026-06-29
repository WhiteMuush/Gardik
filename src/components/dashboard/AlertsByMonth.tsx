"use client"

import { useState } from "react"
import { Settings2, Check } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { useDashboardEditing } from "@/contexts/DashboardEditContext"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"

type Period = "3m" | "6m" | "1y"
type MonthData = { month: string; critical: number; high: number; medium: number; low: number }

const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "1y", label: "1 year",   months: 12 },
]

const SEV_COLORS = {
  critical: "oklch(var(--severity-critical))",
  high:     "oklch(var(--severity-high))",
  medium:   "oklch(var(--severity-medium))",
  low:      "oklch(var(--severity-low))",
}

export function AlertsByMonth({ data }: { data: MonthData[] }) {
  const { title } = useWidgetTitle("alerts-by-month", "Alerts by Month")
  const editing = useDashboardEditing()
  const [config, setConfig] = useWidgetConfig<{ period: Period }>("alerts-by-month", { period: "6m" })
  const [showSettings, setShowSettings] = useState(false)

  const period = PERIODS.find((p) => p.key === config.period) ?? PERIODS[1]
  const sliced = data.slice(-period.months)
  const isEmpty = sliced.every((d) => d.critical + d.high + d.medium + d.low === 0)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
        {editing && (
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {showSettings ? <Check className="size-4" /> : <Settings2 className="size-4" />}
          </button>
        )}
      </div>

      {showSettings && (
        <div className="mb-4 shrink-0 rounded-lg border border-border bg-background p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Period</p>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setConfig({ period: p.key })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  config.period === p.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No alerts recorded</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sliced} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(var(--foreground))",
                }}
              />
              <Bar dataKey="critical" name="Critical" stackId="a" fill={SEV_COLORS.critical} />
              <Bar dataKey="high"     name="High"     stackId="a" fill={SEV_COLORS.high} />
              <Bar dataKey="medium"   name="Medium"   stackId="a" fill={SEV_COLORS.medium} />
              <Bar dataKey="low"      name="Low"      stackId="a" fill={SEV_COLORS.low} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
