"use client"

import { useState } from "react"
import { Radio, Loader2, Copy } from "lucide-react"

type Props = {
  companyId: string
  tokenHint: string | null
  isAdmin: boolean
}

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function SiemExport({ companyId, tokenHint: initialHint, isAdmin }: Props) {
  const [hint, setHint] = useState(initialHint)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const feedUrl = `${origin}/api/integrations/siem/${companyId}?format=cef`

  async function rotate() {
    const fresh = generateToken()
    setBusy(true)
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siemToken: fresh }),
    })
    setBusy(false)
    if (res.ok) {
      setToken(fresh)
      setHint(`...${fresh.slice(-4)}`)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Radio className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">SIEM / SOAR export</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Pull alerts into Splunk, Microsoft Sentinel or any collector. Poll the feed with the bearer
        token below. Supported formats: <code>cef</code>, <code>syslog</code>, <code>json</code> (set
        the <code>format</code> query parameter).
      </p>

      <label className="mb-1 block text-xs font-medium text-muted-foreground">Feed endpoint</label>
      <div className="mb-4 flex items-center gap-2">
        <input
          readOnly
          value={feedUrl}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
        />
        <button
          onClick={() => navigator.clipboard?.writeText(feedUrl)}
          className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Copy"
        >
          <Copy className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <span className="text-sm text-foreground">
          {hint ? `Token configured (${hint})` : "No token configured"}
        </span>
        {isAdmin && (
          <button
            onClick={rotate}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : hint ? "Rotate token" : "Generate token"}
          </button>
        )}
      </div>

      {token && (
        <p className="mt-2 break-all rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          Copy now, it will not be shown again: <span className="font-mono">{token}</span>
        </p>
      )}
    </div>
  )
}
