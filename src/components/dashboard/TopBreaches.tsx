"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type BreachSource = {
  id: string; name: string; source: string
  breachDate: string; dataTypes: string[]; affectedEmployees: number
}

const SOURCE_COLOR: Record<string, string> = {
  HIBP:     "oklch(var(--primary))",
  MANUAL:   "hsl(270 50% 60%)",
  DARK_WEB: "oklch(var(--severity-critical))",
}

export function TopBreaches({ data }: { data: BreachSource[] }) {
  const { title } = useWidgetTitle("top-breaches", "Top Breaches by Impact")

  const sorted = [...data]
    .sort((a, b) => b.affectedEmployees - a.affectedEmployees)
    .slice(0, 8)
    .map((b) => ({ ...b, shortName: b.name.length > 20 ? b.name.slice(0, 18) + "…" : b.name }))

  const isEmpty = sorted.length === 0

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">Ranked by affected employees</p>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No breaches detected</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
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
                dataKey="shortName"
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(var(--foreground))",
                }}
                formatter={(value) => [`${value} employees`, "Affected"]}
                labelFormatter={(label) => {
                  const b = sorted.find((s) => s.shortName === label)
                  return b?.name ?? label
                }}
              />
              <Bar dataKey="affectedEmployees" name="Affected" radius={[0, 4, 4, 0]}>
                {sorted.map((entry) => (
                  <Cell key={entry.id} fill={SOURCE_COLOR[entry.source] ?? "oklch(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
