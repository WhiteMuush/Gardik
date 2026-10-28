"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { REPORT_SECTIONS, fieldClass } from "./notification-meta"

export type NewSchedule = { frequency: "WEEKLY" | "MONTHLY"; recipients: string[]; sections: string[] }

type Props = {
  busy: boolean
  error: string | null
  onAdd: (s: NewSchedule) => Promise<boolean>
  onCancel: () => void
}

export function AddScheduleForm({ busy, error, onAdd, onCancel }: Props) {
  const [frequency, setFrequency] = useState<NewSchedule["frequency"]>("WEEKLY")
  const [recipients, setRecipients] = useState("")
  const [sections, setSections] = useState<string[]>(["exposure", "compliance"])

  function toggleSection(key: string) {
    setSections((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  async function submit() {
    const list = recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
    if (await onAdd({ frequency, recipients: list, sections })) setRecipients("")
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <p className="mb-4 text-sm font-semibold text-foreground">Add a schedule</p>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Frequency</span>
          <select
            className={fieldClass}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as NewSchedule["frequency"])}
          >
            <option value="WEEKLY">Every week</option>
            <option value="MONTHLY">Every month</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Recipients, separated by commas</span>
          <input
            className={fieldClass}
            placeholder="ciso@company.com, compliance@company.com"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
          />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-1.5 text-sm font-medium text-foreground">Sections</legend>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_SECTIONS.map((sec) => (
            <button
              key={sec.key}
              type="button"
              aria-pressed={sections.includes(sec.key)}
              onClick={() => toggleSection(sec.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                sections.includes(sec.key)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={busy || !recipients.trim() || sections.length === 0}>
          {busy && <Loader2 className="animate-spin" />}
          Add schedule
        </Button>
      </div>
    </div>
  )
}
