"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useStepUpRetry } from "./useStepUpRetry"

type Props = { name: string; email: string; role: string; company: string }

export function ProfileSection({ name, email, role, company }: Props) {
  const router = useRouter()
  const { run, dialog } = useStepUpRetry()
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const res = await run(() =>
      fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      })
    )
    setBusy(false)
    if (!res) return
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setMessage({ ok: false, text: body.error ?? "Could not save your name" })
      return
    }
    setMessage({ ok: true, text: "Saved" })
    router.refresh()
  }

  const unchanged = value.trim() === name || value.trim() === ""

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={100}
            autoComplete="name"
            placeholder="Your name"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit" disabled={busy || unchanged}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </form>
      {message ? (
        <p className={message.ok ? "text-xs text-muted-foreground" : "text-xs text-severity-critical-fg"}>
          {message.text}
        </p>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["Email", email],
          ["Role", role],
          ["Company", company],
        ].map(([label, text]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-foreground">{text}</dd>
          </div>
        ))}
      </dl>
      {dialog}
    </div>
  )
}
