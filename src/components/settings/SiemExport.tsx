"use client"

import { useState } from "react"
import { Radio, Loader2, Copy } from "lucide-react"

type Props = {
  companyId: string
  tokenHint: string | null
  pushHint: string | null
  pushFormat: string | null
  isAdmin: boolean
}

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function SiemExport({ companyId, tokenHint: initialHint, pushHint: initialPushHint, pushFormat, isAdmin }: Props) {
  const [hint, setHint] = useState(initialHint)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pushHint, setPushHint] = useState(initialPushHint)
  const [pushUrl, setPushUrl] = useState("")
  const [pushFmt, setPushFmt] = useState(pushFormat ?? "cef")
  const [pushBusy, setPushBusy] = useState(false)

  async function savePush() {
    setPushBusy(true)
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siemPush: { url: pushUrl, format: pushFmt } }),
    })
    setPushBusy(false)
    if (res.ok) {
      setPushHint(new URL(pushUrl).host)
      setPushUrl("")
    }
  }

  async function clearPush() {
    setPushBusy(true)
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siemPush: null }),
    })
    setPushBusy(false)
    if (res.ok) setPushHint(null)
  }

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

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-1 text-xs font-medium text-foreground">Push delivery (optional)</p>
        <p className="mb-3 text-xs text-muted-foreground">
          POST new alerts to an HTTPS collector (Splunk HEC, Sentinel, generic) on each scheduler
          tick. Raw UDP/TCP syslog sockets are not supported.
        </p>
        {pushHint ? (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-foreground">
              Pushing {pushFmt.toUpperCase()} to {pushHint}
            </span>
            {isAdmin && (
              <button
                onClick={clearPush}
                disabled={pushBusy}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
              >
                {pushBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Remove"}
              </button>
            )}
          </div>
        ) : (
          isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pushFmt}
                onChange={(e) => setPushFmt(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              >
                <option value="cef">CEF</option>
                <option value="syslog">Syslog</option>
              </select>
              <input
                placeholder="https://collector.example.com/ingest"
                value={pushUrl}
                onChange={(e) => setPushUrl(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
              <button
                onClick={savePush}
                disabled={pushBusy || !pushUrl.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {pushBusy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
