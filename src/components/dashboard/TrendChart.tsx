"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface TrendChartProps {
  data: { month: string; count: number }[]
}

export function TrendChart({ data }: TrendChartProps) {
  const isEmpty = data.every((d) => d.count === 0)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground">Incident Timeline</h2>
        <p className="text-xs text-muted-foreground">New detections over the last 6 months</p>
      </div>
      {isEmpty ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No incidents recorded</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.488 0.243 264.376)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="oklch(0.488 0.243 264.376)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.22 0.018 280)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "oklch(0.58 0.025 280)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "oklch(0.58 0.025 280)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.13 0.012 280)",
                border: "1px solid oklch(0.22 0.018 280)",
                borderRadius: "8px",
                color: "oklch(0.96 0.005 280)",
                fontSize: "12px",
              }}
              cursor={{ stroke: "oklch(0.22 0.018 280)" }}
              formatter={(value: number) => [value, "Detections"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="oklch(0.488 0.243 264.376)"
              strokeWidth={2}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "oklch(0.488 0.243 264.376)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
