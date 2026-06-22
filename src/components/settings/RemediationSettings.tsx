"use client"

import { useState } from "react"
import { ShieldAlert, Loader2 } from "lucide-react"

export type RemediationLogRow = {
  action: string
  status: string
  target: string
  detail: string | null
  createdAt: string
}

type Props = {
  enabled: boolean
  isAdmin: boolean
  recent: RemediationLogRow[]
}

const ACTION_LABEL: Record<string, string> = {
  REVOKE_SESSIONS: "Revoke sessions",
  FORCE_PASSWORD_RESET: "Force password reset",
}

export function RemediationSettings({ enabled: initialEnabled, isAdmin, recent }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !enabled
    if (next && !window.confirm("Enable live remediation? This lets admins force password resets and revoke sessions directly on your connected directory."))
      return
    setBusy(true)
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remediationEnabled: next }),
    })
    setBusy(false)
    if (res.ok) setEnabled(next)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldAlert className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Automated remediation</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        When enabled, admins can revoke sessions and force password resets on exposed accounts
        directly through the connected directory (Entra, Google, Okta). Actions are irreversible and
        run against your live IdP.
      </p>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <span className="text-sm text-foreground">
          Live remediation is {enabled ? "enabled" : "disabled"}
        </span>
        {isAdmin && (
          <button
            onClick={toggle}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : enabled ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recent actions</p>
          <div className="space-y-1">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
                <span className={r.status === "SUCCESS" ? "text-severity-ok" : "text-severity-critical"}>
                  {r.status === "SUCCESS" ? "OK" : "FAIL"}
                </span>
                <span className="text-foreground">{ACTION_LABEL[r.action] ?? r.action}</span>
                <span className="truncate text-muted-foreground">{r.target}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
