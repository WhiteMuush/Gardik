"use client"

import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

type ExposureLevels = { none: number; one: number; multiple: number }

export function EmployeeExposure({ data, totalEmployees }: { data: ExposureLevels; totalEmployees: number }) {
  const { title } = useWidgetTitle("employee-exposure", "Employee Exposure")

  const tiers = [
    {
      label: "Clean",
      description: "Never compromised",
      count: data.none,
      icon: ShieldCheck,
      color: "oklch(var(--severity-low))",
      bg: "oklch(var(--severity-low) / 0.1)",
    },
    {
      label: "Exposed",
      description: "1 breach detected",
      count: data.one,
      icon: ShieldAlert,
      color: "oklch(var(--severity-medium))",
      bg: "oklch(var(--severity-medium) / 0.1)",
    },
    {
      label: "Critical",
      description: "2+ breaches detected",
      count: data.multiple,
      icon: ShieldX,
      color: "oklch(var(--severity-critical))",
      bg: "oklch(var(--severity-critical) / 0.1)",
    },
  ]

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{totalEmployees} employees total</p>
      </div>

      <div className="flex flex-1 min-h-0 items-center">
        <div className="grid w-full grid-cols-3 gap-3">
          {tiers.map((tier) => {
            const Icon = tier.icon
            const pct = totalEmployees > 0
              ? Math.round((tier.count / totalEmployees) * 100)
              : 0
            return (
              <div
                key={tier.label}
                className="flex flex-col items-center gap-2 rounded-xl p-3"
                style={{ background: tier.bg }}
              >
                <div className="rounded-lg p-2" style={{ background: tier.bg }}>
                  <Icon className="size-5" style={{ color: tier.color }} />
                </div>
                <span className="text-2xl font-bold text-foreground">{tier.count}</span>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">{tier.label}</p>
                  <p className="text-[10px] text-muted-foreground">{pct}%</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-3 shrink-0">
        <div className="flex h-2 w-full overflow-hidden rounded-full">
          {tiers.map((tier) => (
            <div
              key={tier.label}
              style={{
                width: totalEmployees > 0 ? `${(tier.count / totalEmployees) * 100}%` : "0%",
                background: tier.color,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
