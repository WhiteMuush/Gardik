"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OverviewPanel } from "@/components/ui/OverviewPanel"
import type { WebhookRow } from "@/lib/webhooks"
import { AddChannelForm, type NewChannel } from "./AddChannelForm"
import { ChannelTable } from "./ChannelTable"
import { plural } from "./notification-meta"

const FEATURES = [
  { logo: "/sources/slack.png", title: "Slack", text: "Posts to a channel through an incoming webhook." },
  {
    logo: "/sources/teams.png",
    title: "Microsoft Teams",
    text: "Posts to a channel through an incoming webhook.",
  },
  { logo: "/sources/email.svg", title: "Email", text: "Sends each alert to the address you choose." },
  { logo: "/sources/webhook.svg", title: "Webhook", text: "Posts the alert as JSON to any HTTPS endpoint." },
]

export function AlertChannelsPanel({ initial, isAdmin }: { initial: WebhookRow[]; isAdmin: boolean }) {
  const [hooks, setHooks] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tested, setTested] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(initial.length === 0)

  async function add(c: NewChannel) {
    setBusy("add")
    setError(null)
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      setError(data.error ?? "Could not add the channel.")
      return false
    }
    setHooks((h) => [data, ...h])
    setAdding(false)
    return true
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(id)
    const res = await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) setHooks((h) => h.map((w) => (w.id === id ? { ...w, enabled } : w)))
    setBusy(null)
  }

  async function remove(id: string) {
    setBusy(id)
    const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
    if (res.ok) setHooks((h) => h.filter((w) => w.id !== id))
    setBusy(null)
  }

  async function test(id: string) {
    setBusy(id)
    const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" })
    const data = await res.json()
    setTested((t) => ({ ...t, [id]: Boolean(data.delivered) }))
    setBusy(null)
  }

  const active = hooks.filter((w) => w.enabled).length

  return (
    <OverviewPanel
      title="Get alerted where your team works"
      description="Gardik posts each new exposure to your tools as soon as it is detected. Each channel only gets alerts at or above the severity you pick."
      status={{ on: active > 0, label: active ? plural(active, "active channel") : "No active channel" }}
      action={
        isAdmin &&
        !adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add channel
          </Button>
        )
      }
      features={FEATURES}
    >
      <ChannelTable
        hooks={hooks}
        isAdmin={isAdmin}
        busy={busy}
        tested={tested}
        onTest={(id) => void test(id)}
        onToggle={(id, enabled) => void toggle(id, enabled)}
        onRemove={(id) => void remove(id)}
      />
      {isAdmin && adding && (
        <AddChannelForm busy={busy === "add"} error={error} onAdd={add} onCancel={() => setAdding(false)} />
      )}
    </OverviewPanel>
  )
}
