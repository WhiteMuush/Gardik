"use client"

import { useState } from "react"
import { ShieldCheck, Loader2 } from "lucide-react"

export type AuthMethodOption = "TOTP" | "EMAIL_OTP" | "PASSKEY"

const METHOD_LABEL: Record<AuthMethodOption, string> = {
  TOTP: "Authenticator app (TOTP)",
  EMAIL_OTP: "Email one-time code",
  PASSKEY: "Passkey",
}

const ALL_METHODS: AuthMethodOption[] = ["TOTP", "EMAIL_OTP", "PASSKEY"]

type Props = {
  require2fa: boolean
  allowedAuthMethods: AuthMethodOption[]
  isAdmin: boolean
}

export function AuthPolicySettings({
  require2fa: initialRequire2fa,
  allowedAuthMethods: initialAllowedAuthMethods,
  isAdmin,
}: Props) {
  const [require2fa, setRequire2fa] = useState(initialRequire2fa)
  const [allowedAuthMethods, setAllowedAuthMethods] = useState(initialAllowedAuthMethods)
  const [busy, setBusy] = useState(false)

  async function patch(body: { require2fa?: boolean; allowedAuthMethods?: AuthMethodOption[] }) {
    setBusy(true)
    const res = await fetch("/api/company/auth-policy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setBusy(false)
    return res.ok
  }

  async function toggleRequire2fa() {
    const next = !require2fa
    if (await patch({ require2fa: next })) setRequire2fa(next)
  }

  async function toggleMethod(method: AuthMethodOption) {
    const next = allowedAuthMethods.includes(method)
      ? allowedAuthMethods.filter((m) => m !== method)
      : [...allowedAuthMethods, method]
    if (next.length === 0) return
    if (await patch({ allowedAuthMethods: next })) setAllowedAuthMethods(next)
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Authentication policy</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Control whether members of this company must enroll in two-factor authentication, and
        which methods are allowed.
      </p>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <span className="text-sm text-foreground">
          Two-factor authentication is {require2fa ? "required" : "optional"}
        </span>
        {isAdmin && (
          <button
            onClick={toggleRequire2fa}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : require2fa ? "Make optional" : "Require"}
          </button>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Allowed methods</p>
        <div className="space-y-1">
          {ALL_METHODS.map((method) => (
            <label
              key={method}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-foreground"
            >
              <input
                type="checkbox"
                checked={allowedAuthMethods.includes(method)}
                disabled={!isAdmin || busy}
                onChange={() => toggleMethod(method)}
              />
              {METHOD_LABEL[method]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
