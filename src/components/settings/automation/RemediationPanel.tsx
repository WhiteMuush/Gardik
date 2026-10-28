"use client"

import { useState } from "react"
import { Building2, KeyRound, Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Warning } from "../setup-guides/parts"
import { OverviewPanel } from "@/components/ui/OverviewPanel"

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

const FEATURES = [
  {
    icon: LogOut,
    title: "Revoke sessions",
    text: "Signs the employee out everywhere, so a stolen session stops working.",
  },
  {
    icon: KeyRound,
    title: "Force a password reset",
    text: "The employee picks a new password at next sign-in, so a leaked one is useless.",
  },
  {
    icon: Building2,
    title: "Supported directories",
    text: "Entra ID revokes sessions. Google Workspace and Okta do both actions.",
  },
]

export function RemediationPanel({ enabled: initialEnabled, isAdmin, recent }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)

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
    <OverviewPanel
      title="Act on exposed accounts"
      description="When an employee shows up in a breach, admins can cut off access from the alert itself, through the connected directory."
      status={{ on: enabled, label: enabled ? "Enabled" : "Disabled" }}
      action={
        isAdmin && (
          <Button variant={enabled ? "outline" : "default"} onClick={() => void toggle()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {enabled ? "Disable remediation" : "Enable remediation"}
          </Button>
        )
      }
      features={FEATURES}
    >
      <Warning>
        Actions are irreversible and run against your live identity provider. Every attempt is recorded below.
      </Warning>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Recent actions</p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action yet.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={r.status === "SUCCESS" ? "text-severity-ok-fg" : "text-severity-critical-fg"}
                >
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
    </OverviewPanel>
  )
}
