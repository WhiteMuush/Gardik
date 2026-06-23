"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Check, CheckCheck, Loader2, Download, LogOut, KeyRound } from "lucide-react"
import { RiskBadge } from "@/components/ui/RiskBadge"
import type { AlertRow } from "@/lib/alerts"
import type { RiskLevel } from "@/lib/employees"
import { downloadCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const
const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const
const CONFIDENCES = ["HIGH", "MEDIUM", "LOW"] as const

const borderBySeverity: Record<string, string> = {
  CRITICAL: "border-l-severity-critical",
  HIGH: "border-l-severity-high",
  MEDIUM: "border-l-severity-medium",
  LOW: "border-l-severity-low",
}

// Confidence is the reliability of the reporting source, not the impact. A
// low-confidence hit (noisy OSINT feed) is muted/amber so a responder verifies
// it before acting on it.
const confidenceChip: Record<string, string> = {
  HIGH: "border-border text-muted-foreground",
  MEDIUM: "border-border text-muted-foreground",
  LOW: "border-severity-medium/40 text-severity-medium",
}

const confidenceLabel: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
}

const statusLabel: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function AlertTable({
  data,
  remediationEnabled = false,
  isAdmin = false,
}: {
  data: AlertRow[]
  remediationEnabled?: boolean
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [severity, setSeverity] = useState("")
  const [status, setStatus] = useState("")
  const [confidence, setConfidence] = useState("")
  const [pending, setPending] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        a.message.toLowerCase().includes(q) ||
        (a.employeeEmail?.toLowerCase().includes(q) ?? false) ||
        (a.breachName?.toLowerCase().includes(q) ?? false)
      const matchSeverity = !severity || a.severity === severity
      const matchStatus = !status || a.status === status
      const matchConfidence = !confidence || a.confidence === confidence
      return matchSearch && matchSeverity && matchStatus && matchConfidence
    })
  }, [data, search, severity, status, confidence])

  function exportCsv() {
    downloadCsv(
      "datashield-alerts.csv",
      ["severity", "confidence", "status", "employee", "breach", "message", "created"],
      filtered.map((a) => [
        a.severity,
        a.confidence,
        a.status,
        a.employeeEmail ?? "",
        a.breachName ?? "",
        a.message,
        new Date(a.createdAt).toISOString(),
      ])
    )
  }

  async function updateStatus(id: string, next: string) {
    setPending(id)
    const res = await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    setPending(null)
    if (res.ok) router.refresh()
  }

  async function remediate(id: string, action: string, label: string) {
    if (!window.confirm(`${label} for this employee on the connected directory? This cannot be undone.`))
      return
    setPending(id)
    const res = await fetch(`/api/alerts/${id}/remediate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const body = await res.json().catch(() => ({}))
    setPending(null)
    if (res.ok) router.refresh()
    else window.alert(body.error ?? body.detail ?? "Remediation failed")
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">All confidence</option>
          {CONFIDENCES.map((c) => <option key={c} value={c}>{confidenceLabel[c]}</option>)}
        </select>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No alerts found
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-4 rounded-xl border border-l-4 border-border bg-card px-4 py-3",
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
                {remediationEnabled && isAdmin && a.employeeEmail && (
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
                    {pending === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
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
          ))}
        </div>
      )}
    </>
  )
}
