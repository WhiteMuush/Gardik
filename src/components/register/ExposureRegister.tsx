"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Download, ShieldAlert } from "lucide-react"
import { PRESET_DATA_TYPES } from "@/lib/dataTypes"
import type { RegisterRow } from "@/lib/register"

const STATUS_LABEL: Record<string, string> = {
  ASSESSING: "Assessing",
  NOTIFIED: "Notified",
  NOT_REQUIRED: "Not required",
}

function countdown(row: RegisterRow): { text: string; className: string } {
  if (row.status !== "ASSESSING") return { text: STATUS_LABEL[row.status], className: "text-muted-foreground" }
  if (row.overdue) return { text: "72h deadline passed", className: "text-severity-critical" }
  if (row.hoursRemaining <= 24) return { text: `${row.hoursRemaining}h left`, className: "text-severity-high" }
  return { text: `${row.hoursRemaining}h left`, className: "text-muted-foreground" }
}

export function ExposureRegister({
  initial,
  isAdmin,
  canDownloadEvidence,
}: {
  initial: RegisterRow[]
  isAdmin: boolean
  /**
   * Mirrors register:evidence, which the evidence route enforces. Distinct
   * from isAdmin, which is register:manage: this link sits outside that block
   * and was offered to every reader of the register.
   */
  canDownloadEvidence: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [title, setTitle] = useState("")
  const [affected, setAffected] = useState("")
  const [types, setTypes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  function toggleType(key: string) {
    setTypes((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]))
  }

  async function add() {
    setBusy(true)
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, affectedCount: Number(affected) || 0, dataTypes: types }),
    })
    setBusy(false)
    if (res.ok) {
      setRows(await res.json())
      setTitle("")
      setAffected("")
      setTypes([])
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/register/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    router.refresh()
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: status as RegisterRow["status"] } : r)))
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Record an exposure</h3>
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="Title (e.g. Acme breach, payroll data)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
            <input
              type="number"
              min="0"
              placeholder="Affected"
              value={affected}
              onChange={(e) => setAffected(e.target.value)}
              className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESET_DATA_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => toggleType(t.key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  types.includes(t.key)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={add}
              disabled={busy || !title.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Add to register"}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card py-12 text-center text-sm text-muted-foreground">
          No exposures recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const cd = countdown(r)
            return (
              <div key={r.id} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(r.detectedAt).toLocaleString()} - {r.affectedCount} affected
                    </p>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${cd.className}`}>
                    {r.overdue && r.status === "ASSESSING" && <ShieldAlert className="size-3.5" />}
                    {cd.text}
                  </span>
                  {isAdmin && r.status === "ASSESSING" && (
                    <>
                      <button
                        onClick={() => setStatus(r.id, "NOTIFIED")}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        Mark notified
                      </button>
                      <button
                        onClick={() => setStatus(r.id, "NOT_REQUIRED")}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        Not required
                      </button>
                    </>
                  )}
                  {canDownloadEvidence && (
                    <a
                      href={`/api/register/${r.id}/evidence`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                      title="Download evidence pack (CSV)"
                    >
                      <Download className="size-3.5" />
                    </a>
                  )}
                </div>
                {r.categoryLabels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.categoryLabels.map((c) => (
                      <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
