"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"
import { useDashboardEditing } from "@/contexts/DashboardEditContext"

type AlertSeverity = { critical: number; high: number; medium: number; low: number }

const SEVERITY = [
  { key: "critical", label: "Critical", color: "oklch(var(--severity-critical))" },
  { key: "high",     label: "High",     color: "oklch(var(--severity-high))" },
  { key: "medium",   label: "Medium",   color: "oklch(var(--severity-medium))" },
  { key: "low",      label: "Low",      color: "oklch(var(--severity-low))" },
] as const

export function SeverityDonut({ data }: { data: AlertSeverity }) {
  const editing = useDashboardEditing()
  const { title } = useWidgetTitle("severity-donut", "Alert Severity")

  const chartData = SEVERITY
    .map((s) => ({ name: s.label, value: data[s.key], color: s.color }))
    .filter((d) => d.value > 0)

  const total = Object.values(data).reduce((a, b) => a + b, 0)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{total} open alerts</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No open alerts</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius="45%"
                outerRadius="65%"
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
                formatter={(value) => [`${value} alerts`, ""]}
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
