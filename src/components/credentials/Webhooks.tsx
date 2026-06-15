"use client"

import { useState } from "react"
import { Webhook, Trash2, Loader2, Send, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WebhookRow } from "@/lib/webhooks"

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const

type Props = {
  initial: WebhookRow[]
  isAdmin: boolean
}

export function Webhooks({ initial, isAdmin }: Props) {
  const [hooks, setHooks] = useState(initial)
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const [minSeverity, setMinSeverity] = useState<string>("MEDIUM")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tested, setTested] = useState<Record<string, boolean>>({})

  async function add() {
    setBusy("add")
    setError(null)
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, url, minSeverity }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) return setError(data.error ?? "Failed to add webhook")
    setHooks((h) => [data, ...h])
    setLabel("")
    setUrl("")
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(id)
    await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    setHooks((h) => h.map((w) => (w.id === id ? { ...w, enabled } : w)))
    setBusy(null)
  }

  async function remove(id: string) {
    setBusy(id)
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
    setHooks((h) => h.filter((w) => w.id !== id))
    setBusy(null)
  }

  async function test(id: string) {
    setBusy(id)
    const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" })
    const data = await res.json()
    setTested((t) => ({ ...t, [id]: Boolean(data.delivered) }))
    setBusy(null)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Webhook className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Notification webhooks</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        POST a JSON payload to Slack, Teams or any HTTPS endpoint when a new exposure is detected.
      </p>

      <div className="space-y-2">
        {hooks.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No webhooks configured</p>
        )}
        {hooks.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{w.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {w.urlHint} - min {w.minSeverity}
              </p>
            </div>
            {tested[w.id] !== undefined &&
              (tested[w.id] ? (
                <Check className="size-4 text-severity-ok" />
              ) : (
                <X className="size-4 text-severity-critical" />
              ))}
            {isAdmin && (
              <>
                <span className="text-xs text-muted-foreground">{w.enabled ? "On" : "Off"}</span>
                <button
                  onClick={() => toggle(w.id, !w.enabled)}
                  disabled={busy === w.id}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
                >
                  {w.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => test(w.id)}
                  disabled={busy === w.id}
                  title="Send test"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  {busy === w.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
                <button
                  onClick={() => remove(w.id)}
                  disabled={busy === w.id}
                  title="Delete"
                  className="text-muted-foreground hover:text-severity-critical disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <input
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
          <input
            placeholder="https://hooks.slack.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
          <select
            value={minSeverity}
            onChange={(e) => setMinSeverity(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Button size="sm" onClick={add} disabled={busy === "add" || !label.trim() || !url.trim()}>
            {busy === "add" ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-severity-critical">{error}</p>}
    </div>
  )
}
