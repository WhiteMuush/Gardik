import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/employees"

const config: Record<RiskLevel, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "text-severity-critical bg-severity-critical/10" },
  HIGH:     { label: "High",     className: "text-severity-high bg-severity-high/10" },
  MEDIUM:   { label: "Medium",   className: "text-severity-medium bg-severity-medium/10" },
  LOW:      { label: "Low",      className: "text-severity-low bg-severity-low/10" },
  OK:       { label: "OK",       className: "text-severity-ok bg-severity-ok/10" },
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, className } = config[level]
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  )
}
