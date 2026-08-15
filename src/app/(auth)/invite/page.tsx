"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/invitation"

// The invitee has no session yet, so this page is public. It never states
// whether the token is real before a password is submitted: the answer comes
// from the server in one uniform message, which keeps the page from being a
// way to test tokens.
function InviteForm() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmation) {
      setError("The two passwords do not match")
      return
    }
    setPending(true)
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    setPending(false)
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed")
      return
    }
    // No session is issued by the accept endpoint, so the user signs in
    // normally and meets whatever 2FA or SSO policy their company enforces.
    router.push("/login?invited=1")
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-3">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <span className="text-base font-semibold text-foreground">DataShield</span>
      </div>
      <h1 className="text-lg font-semibold text-foreground">Choose your password</h1>
      <p className="text-sm text-muted-foreground">
        This link works once. Your password is never seen by anyone else, including
        the administrator who invited you.
      </p>
      <input
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={`Password (${MIN_PASSWORD_LENGTH} characters minimum)`}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
      <input
        type="password"
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder="Repeat the password"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={pending || token === ""} className="w-full">
        {pending ? "Saving..." : "Activate my account"}
      </Button>
      {token === "" ? (
        <p className="text-xs text-severity-critical">This link is missing its token.</p>
      ) : null}
      {error ? <p className="text-xs text-severity-critical">{error}</p> : null}
    </form>
  )
}

export default function InvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={null}>
        <InviteForm />
      </Suspense>
    </div>
  )
}
