"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WebhookRow } from "@/lib/webhooks"
import { CHANNELS, SEVERITIES, fieldClass } from "./notification-meta"

export type NewChannel = {
  label: string
  url: string
  channel: WebhookRow["channel"]
  minSeverity: WebhookRow["minSeverity"]
}

type Props = {
  busy: boolean
  error: string | null
  onAdd: (c: NewChannel) => Promise<boolean>
  onCancel: () => void
}

export function AddChannelForm({ busy, error, onAdd, onCancel }: Props) {
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const [channel, setChannel] = useState<NewChannel["channel"]>("SLACK")
  const [minSeverity, setMinSeverity] = useState<NewChannel["minSeverity"]>("HIGH")
  const meta = CHANNELS.find((c) => c.id === channel)!

  async function submit() {
    if (await onAdd({ label, url, channel, minSeverity })) {
      setLabel("")
      setUrl("")
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <p className="mb-4 text-sm font-semibold text-foreground">Add a channel</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Name</span>
          <input
            className={fieldClass}
            placeholder="SOC Slack"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Channel</span>
          <select
            className={fieldClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value as NewChannel["channel"])}
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">{meta.target}</span>
          <input
            className={fieldClass}
            placeholder={meta.placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Send alerts</span>
          <select
            className={fieldClass}
            value={minSeverity}
            onChange={(e) => setMinSeverity(e.target.value as NewChannel["minSeverity"])}
          >
            {SEVERITIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={busy || !label.trim() || !url.trim()}>
          {busy && <Loader2 className="animate-spin" />}
          Add channel
        </Button>
      </div>
    </div>
  )
}
