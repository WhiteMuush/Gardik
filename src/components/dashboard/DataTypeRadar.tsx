"use client"

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from "recharts"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type DataType = { type: string; count: number; percentage: number }

function formatType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function DataTypeRadar({ data }: { data: DataType[] }) {
  const { title } = useWidgetTitle("data-type-radar", "Data Type Radar")

  const chartData = data.map((d) => ({
    type: formatType(d.type),
    value: d.count,
    fullMark: Math.max(...data.map((x) => x.count), 1),
  }))

  const isEmpty = data.length === 0

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">Compromised data category spread</p>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data types recorded</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="oklch(var(--border))" />
              <PolarAngleAxis
                dataKey="type"
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 10 }}
              />
              <Radar
                name="Count"
                dataKey="value"
                stroke="oklch(var(--primary))"
                fill="oklch(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(var(--foreground))",
                }}
                formatter={(value) => [`${value} occurrences`, "Count"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
