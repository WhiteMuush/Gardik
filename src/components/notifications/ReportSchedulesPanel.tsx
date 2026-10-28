"use client"

import { useState } from "react"
import { CalendarClock, ListChecks, Paperclip, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OverviewPanel } from "@/components/ui/OverviewPanel"
import { AddScheduleForm, type NewSchedule } from "./AddScheduleForm"
import { ScheduleTable, type ScheduleRow } from "./ScheduleTable"
import { plural } from "./notification-meta"

const FEATURES = [
  { icon: CalendarClock, title: "Every week or month", text: "Pick the rhythm that fits each audience." },
  { icon: Paperclip, title: "PDF and CSV attached", text: "Readers get the full report without an account." },
  {
    icon: ListChecks,
    title: "Only what matters",
    text: "Choose the sections: exposure, compliance, data types, departments, employees, trends.",
  },
]

export function ReportSchedulesPanel({ initial, isAdmin }: { initial: ScheduleRow[]; isAdmin: boolean }) {
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(initial.length === 0)

  async function add(s: NewSchedule) {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/reports/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Could not add the schedule.")
      return false
    }
    setRows((r) => [data, ...r])
    setAdding(false)
    return true
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch(`/api/reports/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) setRows((r) => r.map((s) => (s.id === id ? { ...s, enabled } : s)))
  }

  async function remove(id: string) {
    const res = await fetch(`/api/reports/schedules/${id}`, { method: "DELETE" })
    if (res.ok) setRows((r) => r.filter((s) => s.id !== id))
  }

  const active = rows.filter((s) => s.enabled).length

  return (
    <OverviewPanel
      title="Send reports without logging in"
      description="Gardik emails a report to your stakeholders on a schedule. Email must be configured on the server."
      status={{ on: active > 0, label: active ? plural(active, "active schedule") : "No active schedule" }}
      action={
        isAdmin &&
        !adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add schedule
          </Button>
        )
      }
      features={FEATURES}
    >
      <ScheduleTable
        rows={rows}
        isAdmin={isAdmin}
        onToggle={(id, enabled) => void toggle(id, enabled)}
        onRemove={(id) => void remove(id)}
      />
      {isAdmin && adding && (
        <AddScheduleForm busy={busy} error={error} onAdd={add} onCancel={() => setAdding(false)} />
      )}
    </OverviewPanel>
  )
}
