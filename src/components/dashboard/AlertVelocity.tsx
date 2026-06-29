"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type VelocityData = { day: string; count: number }

export function AlertVelocity({ data }: { data: VelocityData[] }) {
  const { title } = useWidgetTitle("alert-velocity", "Alert Velocity")

  const total = data.reduce((s, d) => s + d.count, 0)
  const firstHalf = data.slice(0, 15).reduce((s, d) => s + d.count, 0)
  const secondHalf = data.slice(15).reduce((s, d) => s + d.count, 0)
  const avg = data.length > 0 ? total / data.length : 0

  const trend = secondHalf > firstHalf + 2 ? "up" : secondHalf < firstHalf - 2 ? "down" : "stable"
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendColor =
    trend === "up" ? "oklch(var(--severity-critical))" :
    trend === "down" ? "oklch(var(--severity-low))" :
    "oklch(var(--muted-foreground))"

  // Show only every 5th label to avoid crowding
  const tickFormatter = (_: string, i: number) => (i % 5 === 0 ? data[i]?.day ?? "" : "")

  const isEmpty = total === 0

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-3 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
        <div className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: `${trendColor}1a` }}>
          <TrendIcon className="size-3.5" style={{ color: trendColor }} />
          <span className="text-xs font-medium" style={{ color: trendColor }}>
            {trend === "up" ? "Rising" : trend === "down" ? "Falling" : "Stable"}
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-3 shrink-0 flex gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold text-foreground">{total}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Daily avg</p>
          <p className="text-lg font-bold text-foreground">{avg.toFixed(1)}</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No alerts in last 30 days</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={tickFormatter}
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <ReferenceLine
                y={avg}
                stroke="oklch(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(var(--foreground))",
                }}
                formatter={(value) => [value, "Alerts"]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="oklch(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "oklch(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
