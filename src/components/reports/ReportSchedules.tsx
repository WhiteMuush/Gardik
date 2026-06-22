"use client"

import { useState } from "react"
import { CalendarClock, Trash2, Loader2 } from "lucide-react"

export type ScheduleRow = {
  id: string
  frequency: "WEEKLY" | "MONTHLY"
  recipients: string[]
  sections: string[]
  enabled: boolean
  lastSentAt: string | null
}

const SECTIONS = [
  { key: "exposure", label: "Exposure" },
  { key: "compliance", label: "Compliance" },
  { key: "datatypes", label: "Data types" },
  { key: "departments", label: "Departments" },
  { key: "employees", label: "Employees" },
  { key: "trends", label: "Trends" },
] as const

export function ReportSchedules({ initial, isAdmin }: { initial: ScheduleRow[]; isAdmin: boolean }) {
  const [rows, setRows] = useState(initial)
  const [frequency, setFrequency] = useState("WEEKLY")
  const [recipients, setRecipients] = useState("")
  const [sections, setSections] = useState<string[]>(["exposure", "compliance"])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSection(key: string) {
    setSections((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  async function add() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/reports/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frequency,
        recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
        sections,
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) return setError(data.error ?? "Failed to add schedule")
    setRows((r) => [data, ...r])
    setRecipients("")
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await fetch(`/api/reports/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    setRows((r) => r.map((s) => (s.id === id ? { ...s, enabled } : s)))
  }

  async function remove(id: string) {
    await fetch(`/api/reports/schedules/${id}`, { method: "DELETE" })
    setRows((r) => r.filter((s) => s.id !== id))
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Scheduled report delivery</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Email a periodic report (PDF and CSV attachments) to stakeholders without anyone logging in.
        Requires email to be configured.
      </p>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No schedules configured</p>
        )}
        {rows.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {s.frequency === "WEEKLY" ? "Weekly" : "Monthly"} - {s.recipients.join(", ")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {s.sections.join(", ")}
                {s.lastSentAt ? ` - last sent ${new Date(s.lastSentAt).toLocaleDateString()}` : " - never sent"}
              </p>
            </div>
            {isAdmin && (
              <>
                <button
                  onClick={() => toggleEnabled(s.id, !s.enabled)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  title="Delete"
                  className="text-muted-foreground hover:text-severity-critical"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <input
              placeholder="ciso@company.com, compliance@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((sec) => (
              <button
                key={sec.key}
                onClick={() => toggleSection(sec.key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  sections.includes(sec.key)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={add}
              disabled={busy || !recipients.trim() || sections.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Add schedule"}
            </button>
          </div>
          {error && <p className="text-xs text-severity-critical">{error}</p>}
        </div>
      )}
    </div>
  )
}
