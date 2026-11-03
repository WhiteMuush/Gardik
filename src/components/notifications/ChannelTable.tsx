"use client"

import { Loader2, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WebhookRow } from "@/lib/webhooks"
import { CHANNELS, SEVERITIES } from "./notification-meta"

type Props = {
  hooks: WebhookRow[]
  isAdmin: boolean
  busy: string | null
  tested: Record<string, boolean>
  onTest: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onRemove: (id: string) => void
}

export function ChannelTable({ hooks, isAdmin, busy, tested, onTest, onToggle, onRemove }: Props) {
  if (hooks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No channel yet. Add one to get alerted where your team works.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Channel</th>
            <th className="px-4 py-3 font-medium">Sends</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {hooks.map((w) => (
            <tr key={w.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{w.label}</p>
                <p className="text-xs text-muted-foreground">{w.urlHint}</p>
              </td>
              <td className="px-4 py-3 text-foreground">{CHANNELS.find((c) => c.id === w.channel)?.label}</td>
              <td className="px-4 py-3 text-foreground">
                {SEVERITIES.find((s) => s.id === w.minSeverity)?.label}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    w.enabled
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {w.enabled ? "Active" : "Paused"}
                </span>
              </td>
              {isAdmin && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    {tested[w.id] !== undefined && (
                      <span
                        className={cn(
                          "text-xs",
                          tested[w.id]
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        )}
                      >
                        {tested[w.id] ? "Delivered" : "Failed"}
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onTest(w.id)} disabled={busy === w.id}>
                      {busy === w.id ? <Loader2 className="animate-spin" /> : <Send />}
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onToggle(w.id, !w.enabled)}
                      disabled={busy === w.id}
                    >
                      {w.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${w.label}`}
                      onClick={() => window.confirm(`Delete the channel "${w.label}"?`) && onRemove(w.id)}
                      disabled={busy === w.id}
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
