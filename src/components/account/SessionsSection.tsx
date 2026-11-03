"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DateTime } from "@/components/ui/DateTime"
import { useStepUpRetry } from "./useStepUpRetry"

// Spelled out field by field, since Intl refuses timeZoneName next to dateStyle or timeStyle.
const STAMP: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
}

export type SessionRow = {
  id: string
  device: string
  ipAddress: string | null
  signedIn: string
  lastRefreshed: string
  current: boolean
}

export function SessionsSection({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter()
  const { run, dialog } = useStepUpRetry()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function revoke(key: string, call: () => Promise<Response>) {
    setBusy(key)
    setError(null)
    const res = await run(call)
    setBusy(null)
    if (!res) return
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? "Could not sign that session out")
      return
    }
    router.refresh()
  }

  const others = sessions.filter((s) => !s.current).length

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                {s.device}
                {s.current ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{s.ipAddress ?? "Unknown IP"}</span>
                <span>
                  Signed in <DateTime value={s.signedIn} options={STAMP} />
                </span>
                <span>
                  Last refreshed <DateTime value={s.lastRefreshed} options={STAMP} />
                </span>
              </p>
            </div>
            {s.current ? null : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void revoke(s.id, () => fetch(`/api/account/sessions/${s.id}`, { method: "DELETE" }))
                }
              >
                {busy === s.id ? "Signing out..." : "Sign out"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            void revoke("others", () => fetch("/api/account/sessions/revoke-others", { method: "POST" }))
          }
        >
          {busy === "others" ? "Signing out..." : `Sign out all other sessions (${others})`}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">No other session is open.</p>
      )}
      {error ? <p className="text-xs text-severity-critical-fg">{error}</p> : null}
      {dialog}
    </div>
  )
}
