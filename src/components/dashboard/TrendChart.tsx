"use client"

import { useState } from "react"
import { Settings2, Check } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { useWidgetConfig } from "@/hooks/useWidgetConfig"
import { useDashboardEditing } from "@/contexts/DashboardEditContext"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { cn } from "@/lib/utils"

type Period = "1m" | "3m" | "6m" | "1y"

const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "1m", label: "1 month",  months: 1 },
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "1y", label: "1 year",   months: 12 },
]

interface TrendChartProps {
  data: { month: string; count: number }[]
}

type WidgetConfig = { period: Period }

export function TrendChart({ data }: TrendChartProps) {
  const editing = useDashboardEditing()
  const [config, setConfig] = useWidgetConfig<WidgetConfig>("trend-chart", { period: "6m" })
  const [showSettings, setShowSettings] = useState(false)
  const { title } = useWidgetTitle("trend-chart", "Incident Timeline")

  const selectedPeriod = PERIODS.find((p) => p.key === config.period) ?? PERIODS[2]
  const sliced = data.slice(-selectedPeriod.months)
  const isEmpty = sliced.every((d) => d.count === 0)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">
            New detections — {selectedPeriod.label}
          </p>
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
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Period
          </p>
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
          <p className="text-sm text-muted-foreground">No incidents recorded</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  color: "oklch(var(--foreground))",
                  fontSize: "12px",
                }}
                cursor={{ stroke: "oklch(var(--border))" }}
                formatter={(value) => [value, "Detections"]}
              />
              <Area type="monotone" dataKey="count" stroke="oklch(var(--primary))" strokeWidth={2} fill="url(#areaGradient)" dot={false} activeDot={{ r: 4, fill: "oklch(var(--primary))" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
