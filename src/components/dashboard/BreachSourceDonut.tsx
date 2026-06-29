"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type BreachSource = {
  id: string; name: string; source: string
  breachDate: string; dataTypes: string[]; affectedEmployees: number
}

const SOURCE_COLORS: Record<string, string> = {
  HIBP:     "oklch(var(--primary))",
  MANUAL:   "hsl(270 50% 60%)",
  DARK_WEB: "oklch(var(--severity-critical))",
}

const SOURCE_LABELS: Record<string, string> = {
  HIBP:     "Have I Been Pwned",
  MANUAL:   "Manual Entry",
  DARK_WEB: "Dark Web",
}

export function BreachSourceDonut({ data }: { data: BreachSource[] }) {
  const { title } = useWidgetTitle("breach-source-donut", "Breach Origin")

  const grouped: Record<string, number> = {}
  data.forEach((b) => { grouped[b.source] = (grouped[b.source] ?? 0) + 1 })

  const chartData = Object.entries(grouped).map(([source, count]) => ({
    name: SOURCE_LABELS[source] ?? source,
    value: count,
    color: SOURCE_COLORS[source] ?? "oklch(var(--muted-foreground))",
  }))

  const total = data.length

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No breaches detected</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="43%"
                innerRadius="42%"
                outerRadius="62%"
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(var(--foreground))",
                }}
                formatter={(v) => [`${v} breach${Number(v) !== 1 ? "es" : ""}`, ""]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: "oklch(var(--foreground))" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
