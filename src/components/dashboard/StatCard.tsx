import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown, Minus, type LucideIcon } from "lucide-react"

export type StatDelta = {
  value: number
  label?: string
  // Which direction is "good" (green). Security metrics usually want "down".
  goodWhen?: "up" | "down"
}

interface StatCardProps {
  label: string
  value: string | number
  description?: string
  icon: LucideIcon
  variant?: "default" | "critical" | "high" | "medium" | "ok"
  delta?: StatDelta
}

const variants = {
  default: {
    value: "text-foreground",
    icon: "text-muted-foreground",
    iconBg: "bg-muted",
  },
  critical: {
    value: "text-severity-critical",
    icon: "text-severity-critical",
    iconBg: "bg-severity-critical/10",
  },
  high: {
    value: "text-severity-high",
    icon: "text-severity-high",
    iconBg: "bg-severity-high/10",
  },
  medium: {
    value: "text-severity-medium",
    icon: "text-severity-medium",
    iconBg: "bg-severity-medium/10",
  },
  ok: {
    value: "text-severity-ok",
    icon: "text-severity-ok",
    iconBg: "bg-severity-ok/10",
  },
}

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  variant = "default",
  delta,
}: StatCardProps) {
  const v = variants[variant]

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={cn("text-3xl font-bold tabular-nums", v.value)}>{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {delta && <DeltaPill delta={delta} />}
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", v.iconBg)}>
          <Icon className={cn("size-5", v.icon)} />
        </div>
      </div>
    </div>
  )
}

function DeltaPill({ delta }: { delta: StatDelta }) {
  const { value, label, goodWhen = "up" } = delta
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat"
  const tone =
    direction === "flat"
      ? "text-muted-foreground"
      : direction === goodWhen
        ? "text-severity-ok"
        : "text-severity-high"

  return (
    <p className={cn("flex items-center gap-1 text-xs font-medium tabular-nums", tone)}>
      <Icon className="size-3" />
      {value > 0 ? "+" : ""}
      {value}
      {label && <span className="font-normal text-muted-foreground">{label}</span>}
    </p>
  )
}
