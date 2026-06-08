"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type DeptData = { department: string; total: number; compromised: number; percentage: number }

export function DepartmentRisk({ data }: { data: DeptData[] }) {
  const { title } = useWidgetTitle("department-risk", "Department Exposure")

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">Compromised employees by department</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
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
                width={90}
                tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(var(--card))",
                  border: "1px solid oklch(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(var(--foreground))",
                }}
                formatter={(value, _name, props) => [
                  `${value} / ${props.payload.total} (${props.payload.percentage}%)`,
                  "Compromised",
                ]}
              />
              <Bar dataKey="compromised" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {data.map((entry) => (
                  <Cell
                    key={entry.department}
                    fill={
                      entry.percentage >= 50
                        ? "oklch(var(--severity-critical))"
                        : entry.percentage >= 25
                        ? "oklch(var(--severity-high))"
                        : "oklch(var(--primary))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
