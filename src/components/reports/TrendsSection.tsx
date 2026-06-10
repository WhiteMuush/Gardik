"use client"

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ReportSection } from "./ReportSection"
import type { Trends } from "@/lib/reports/types"

const axisTick = { fill: "oklch(var(--muted-foreground))", fontSize: 11 }

export function TrendsSection({ data }: { data: Trends }) {
  const isEmpty = data.monthly.every((m) => m.breaches === 0 && m.alerts === 0)

  return (
    <ReportSection
      title="Trends"
      description="New breach detections and alerts over the last 12 months"
    >
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">No activity recorded.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthly} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  color: "oklch(var(--foreground))",
                  fontSize: "12px",
                }}
                cursor={{ stroke: "oklch(var(--border))" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="breaches" name="Breaches" stroke="oklch(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="alerts" name="Alerts" stroke="oklch(var(--severity-high))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ReportSection>
  )
}
