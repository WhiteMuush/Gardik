import { Check, CheckCheck, Loader2, LogOut, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const busy = pending === a.id

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-l-4 border-border/60 bg-card px-4 py-3",
        borderBySeverity[a.severity],
        a.status === "RESOLVED" && "opacity-60"
      )}
    >
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-sm font-medium text-foreground">{a.message}</p>
        <p className="truncate text-xs text-muted-foreground">
          {a.employeeEmail ?? "Unknown employee"}
          {a.breachName ? ` - ${a.breachName}` : ""} - {timeAgo(a.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={a.severity as RiskLevel} suffix="severity" />
        <span
          className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", confidenceChip[a.confidence])}
        >
          {confidenceLabel[a.confidence]}
        </span>
        <span className="text-xs text-muted-foreground">{statusLabel[a.status]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {canRemediate && a.employeeEmail && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => remediate(a.id, "REVOKE_SESSIONS", "Revoke all sessions")}
              disabled={busy}
            >
              <LogOut />
              Revoke sessions
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => remediate(a.id, "FORCE_PASSWORD_RESET", "Force a password reset")}
              disabled={busy}
            >
              <KeyRound />
              Reset password
            </Button>
          </>
        )}
        {a.status === "OPEN" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus(a.id, "ACKNOWLEDGED")}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Acknowledge
          </Button>
        )}
        {a.status !== "RESOLVED" && (
          <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "RESOLVED")} disabled={busy}>
            <CheckCheck />
            Resolve
          </Button>
        )}
      </div>
    </div>
  )
}
