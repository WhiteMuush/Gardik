"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { REPORT_SECTIONS } from "./notification-meta"

export type ScheduleRow = {
  id: string
  frequency: "WEEKLY" | "MONTHLY"
  recipients: string[]
  sections: string[]
  enabled: boolean
  lastSentAt: string | null
}

type Props = {
  rows: ScheduleRow[]
  isAdmin: boolean
  onToggle: (id: string, enabled: boolean) => void
  onRemove: (id: string) => void
}

const sectionLabel = (key: string) => REPORT_SECTIONS.find((s) => s.key === key)?.label ?? key

export function ScheduleTable({ rows, isAdmin, onToggle, onRemove }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No schedule yet. Add one to email reports automatically.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Frequency</th>
            <th className="px-4 py-3 font-medium">Recipients</th>
            <th className="px-4 py-3 font-medium">Sections</th>
            <th className="px-4 py-3 font-medium">Last sent</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3 text-foreground">
                {s.frequency === "WEEKLY" ? "Every week" : "Every month"}
              </td>
              <td className="px-4 py-3 text-foreground">{s.recipients.join(", ")}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.sections.map(sectionLabel).join(", ")}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {s.lastSentAt ? new Date(s.lastSentAt).toLocaleDateString() : "Never"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    s.enabled
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {s.enabled ? "Active" : "Paused"}
                </span>
              </td>
              {isAdmin && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => onToggle(s.id, !s.enabled)}>
                      {s.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete schedule"
                      onClick={() => window.confirm("Delete this report schedule?") && onRemove(s.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
