"use client"

import { ShieldCheck, ShieldX, ShieldQuestion, AlertTriangle } from "lucide-react"
import { useWidgetTitle } from "@/hooks/useWidgetTitle"

export type MfaCoverageData = {
  enabled: number
  disabled: number
  unknown: number
  exposedWithoutMfa: number
  total: number
}

export function MfaCoverage({ data }: { data: MfaCoverageData }) {
  const { title } = useWidgetTitle("mfa-coverage", "MFA Coverage")
  const tiers = [
    { label: "MFA on", count: data.enabled, icon: ShieldCheck, color: "oklch(var(--severity-low))" },
    { label: "MFA off", count: data.disabled, icon: ShieldX, color: "oklch(var(--severity-critical))" },
    { label: "Unknown", count: data.unknown, icon: ShieldQuestion, color: "oklch(var(--muted-foreground))" },
  ]

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 shrink-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tiers.map((tier) => {
          const Icon = tier.icon
          return (
            <div key={tier.label} className="flex flex-col items-center gap-2 rounded-xl p-3">
              <Icon className="size-5" style={{ color: tier.color }} />
              <span className="text-2xl font-bold text-foreground">{tier.count}</span>
              <p className="text-[10px] text-muted-foreground">{tier.label}</p>
            </div>
          )
        })}
      </div>

      {data.exposedWithoutMfa > 0 && (
        <div className="mt-auto flex items-center gap-2 rounded-lg border border-severity-critical/30 bg-severity-critical/10 px-3 py-2">
          <AlertTriangle className="size-4 shrink-0 text-severity-critical" />
          <p className="text-xs text-foreground">
            {data.exposedWithoutMfa} exposed {data.exposedWithoutMfa === 1 ? "account lacks" : "accounts lack"} MFA
          </p>
        </div>
      )}
    </div>
  )
}
