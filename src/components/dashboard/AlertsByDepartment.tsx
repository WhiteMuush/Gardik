"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type DeptData = {
  department: string
  critical: number
  high: number
  medium: number
  low: number
  total: number
}

const SEV_COLORS = {
  critical: "oklch(var(--severity-critical))",
  high:     "oklch(var(--severity-high))",
  medium:   "oklch(var(--severity-medium))",
  low:      "oklch(var(--severity-low))",
}

export function AlertsByDepartment({ data }: { data: DeptData[] }) {
  const { title } = useWidgetTitle("alerts-by-department", "Alerts by Department")

  const isEmpty = data.length === 0 || data.every((d) => d.total === 0)

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">Alert volume per department</p>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No alerts recorded</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 10, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="department"
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
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
              <Bar dataKey="low"      name="Low"      stackId="a" fill={SEV_COLORS.low} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
