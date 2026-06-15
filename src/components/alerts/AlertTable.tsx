"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Check, CheckCheck, Loader2, Download } from "lucide-react"
import { RiskBadge } from "@/components/ui/RiskBadge"
import type { AlertRow } from "@/lib/alerts"
import type { RiskLevel } from "@/lib/employees"
import { downloadCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const
const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const

const borderBySeverity: Record<string, string> = {
  CRITICAL: "border-l-severity-critical",
  HIGH: "border-l-severity-high",
  MEDIUM: "border-l-severity-medium",
  LOW: "border-l-severity-low",
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

export function AlertTable({ data }: { data: AlertRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [severity, setSeverity] = useState("")
  const [status, setStatus] = useState("")
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
      return matchSearch && matchSeverity && matchStatus
    })
  }, [data, search, severity, status])

  function exportCsv() {
    downloadCsv(
      "datashield-alerts.csv",
      ["severity", "status", "employee", "breach", "message", "created"],
      filtered.map((a) => [
        a.severity,
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
              <span className="shrink-0 text-xs text-muted-foreground">{statusLabel[a.status]}</span>
              <div className="flex shrink-0 items-center gap-1">
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
