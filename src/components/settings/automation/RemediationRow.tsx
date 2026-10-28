"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Warning } from "../setup-guides/parts"
import { SettingRow } from "./SettingRow"

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

export function RemediationRow({ enabled: initialEnabled, isAdmin, recent }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function toggle() {
    const next = !enabled
    if (
      next &&
      !window.confirm(
        "Enable live remediation? This lets admins force password resets and revoke sessions directly on your connected directory."
      )
    )
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
    <SettingRow
      title="Automated remediation"
      description="Revoke sessions and force password resets on exposed accounts through the connected directory."
      status={{ on: enabled, label: enabled ? "Enabled" : "Disabled" }}
      action={
        isAdmin && (
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            onClick={() => void toggle()}
            disabled={busy}
          >
            {busy && <Loader2 className="animate-spin" />}
            {enabled ? "Disable" : "Enable"}
          </Button>
        )
      }
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <Warning>
        Works with Entra ID, Google Workspace and Okta. Actions are irreversible and run against your live
        IdP.
      </Warning>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Recent actions</p>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No action yet.</p>
        ) : (
          <div className="space-y-1">
            {recent.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs"
              >
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
        )}
      </div>
    </SettingRow>
  )
}
