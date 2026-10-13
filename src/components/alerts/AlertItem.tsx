import { Check, CheckCheck, Loader2, LogOut, KeyRound } from "lucide-react"
import { RiskBadge } from "@/components/ui/RiskBadge"
import type { AlertRow } from "@/lib/alerts"
import type { RiskLevel } from "@/lib/employees"
import { cn } from "@/lib/utils"
import { borderBySeverity, confidenceChip, confidenceLabel, statusLabel, timeAgo } from "./alert-meta"

type Props = {
  a: AlertRow
  pending: string | null
  canRemediate: boolean
  updateStatus: (id: string, next: string) => void
  remediate: (id: string, action: string, label: string) => void
}

export function AlertItem({ a, pending, canRemediate, updateStatus, remediate }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-l-4 border-border/60 bg-card px-4 py-3",
        borderBySeverity[a.severity],
        a.status === "RESOLVED" && "opacity-60"
      )}
    >
      <RiskBadge level={a.severity as RiskLevel} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{a.message}</p>
        <p className="truncate text-xs text-muted-foreground">
          {a.employeeEmail ?? "Unknown employee"}
          {a.breachName ? ` - ${a.breachName}` : ""} - {timeAgo(a.createdAt)}
        </p>
      </div>
      <span
        title={confidenceLabel[a.confidence]}
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          confidenceChip[a.confidence]
        )}
      >
        {a.confidence}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{statusLabel[a.status]}</span>
      <div className="flex shrink-0 items-center gap-1">
        {canRemediate && a.employeeEmail && (
          <>
            <button
              onClick={() => remediate(a.id, "REVOKE_SESSIONS", "Revoke all sessions")}
              disabled={pending === a.id}
              title="Revoke sessions"
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-severity-critical disabled:opacity-30"
            >
              <LogOut className="size-3.5" />
            </button>
            <button
              onClick={() => remediate(a.id, "FORCE_PASSWORD_RESET", "Force a password reset")}
              disabled={pending === a.id}
              title="Force password reset"
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-severity-critical disabled:opacity-30"
            >
              <KeyRound className="size-3.5" />
            </button>
          </>
        )}
        {a.status === "OPEN" && (
          <button
            onClick={() => updateStatus(a.id, "ACKNOWLEDGED")}
            disabled={pending === a.id}
            title="Acknowledge"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            {pending === a.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </button>
        )}
        {a.status !== "RESOLVED" && (
          <button
            onClick={() => updateStatus(a.id, "RESOLVED")}
            disabled={pending === a.id}
            title="Resolve"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <CheckCheck className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
