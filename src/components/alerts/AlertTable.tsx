"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Download } from "lucide-react"
import type { AlertRow } from "@/lib/alerts"
import { downloadCsv } from "@/lib/csv"
import { confidenceLabel, statusLabel } from "./alert-meta"
import { AlertItem } from "./AlertItem"

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const
const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const
const CONFIDENCES = ["HIGH", "MEDIUM", "LOW"] as const

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
      "gardik-alerts.csv",
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm sm:flex-1">
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
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">All confidence</option>
          {CONFIDENCES.map((c) => (
            <option key={c} value={c}>
              {confidenceLabel[c]}
            </option>
          ))}
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
        <div className="rounded-xl border border-border/60 bg-card py-12 text-center text-sm text-muted-foreground">
          No alerts found
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <AlertItem
              key={a.id}
              a={a}
              pending={pending}
              canRemediate={remediationEnabled && isAdmin}
              updateStatus={(id, next) => void updateStatus(id, next)}
              remediate={(id, action, label) => void remediate(id, action, label)}
            />
          ))}
        </div>
      )}
    </>
  )
}
