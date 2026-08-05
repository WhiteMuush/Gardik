"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { signIn, twoFactor } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

// Covers the gap between "credentials accepted" and "dashboard painted". That
// stretch is the slowest part of signing in and used to show nothing at all:
// the button had already snapped back to its idle label. Rendered only once
// authentication has actually succeeded, never during the check itself.
function EnteringWorkspace() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background"
    >
      <ShieldCheck aria-hidden className="size-10 animate-pulse text-primary" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Opening your workspace...
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  // Which action is in flight, not merely whether one is: the spinner belongs on
  // the button that was actually clicked, and the passkey button must keep its
  // own label so its accessible name never collides with "Sign in".
  const [pending, setPending] = useState<null | "password" | "passkey" | "totp" | "otp">(null)
  const loading = pending !== null
  const [entering, setEntering] = useState(false)
  const [needsTotp, setNeedsTotp] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const router = useRouter()

  // Every successful path funnels through here so the transition screen is the
  // single thing standing between authentication and the dashboard.
  function enterWorkspace() {
    setEntering(true)
    router.push("/dashboard")
  }

  function chooseEmail() {
    setError(null)
    setEmailMode(true)
    setOtpSent(false)
  }

  function chooseTotp() {
    setError(null)
    setEmailMode(false)
    setOtpSent(false)
  }

  async function handlePasskey() {
    setPending("passkey")
    setError(null)

    try {
      const res = await signIn.passkey()
      if (res?.error) {
        setError("Passkey sign-in failed or was cancelled")
        setPending(null)
        return
      }
      enterWorkspace()
    } catch {
      setError("Passkey sign-in failed or was cancelled")
      setPending(null)
    }
  }

  async function handleSendOtp() {
    setPending("otp")
    setError(null)

    const { error } = await twoFactor.sendOtp()

    setPending(null)

    if (error) {
      // 403 when the company's policy does not allow EMAIL_OTP; the server hook
      // is the real guard, the UI just reports it.
      setError(
        error.status === 403
          ? "Email codes are disabled by your company's policy"
          : "Could not send a code, try again"
      )
      return
    }

    setOtpSent(true)
  }

  async function handleEmailVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending("otp")
    setError(null)

    const form = new FormData(e.currentTarget)
    const { error } = await twoFactor.verifyOtp({
      code: String(form.get("code")),
    })

    if (error) {
      setPending(null)
      setError("Invalid code")
      return
    }

    enterWorkspace()
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending("password")
    setError(null)

    const form = new FormData(e.currentTarget)
    const { data, error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })

    if (error) {
      setPending(null)
      setError("Invalid email or password")
      return
    }

    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      // Stays on the page to ask for the second factor, so hand control back.
      setPending(null)
      setNeedsTotp(true)
      return
    }

    enterWorkspace()
  }

  async function handleTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending("totp")
    setError(null)

    const form = new FormData(e.currentTarget)
    const { error } = await twoFactor.verifyTotp({
      code: String(form.get("code")),
    })

    if (error) {
      setPending(null)
      setError("Invalid code")
      return
    }

    enterWorkspace()
  }

  if (entering) return <EnteringWorkspace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              DataShield
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {!needsTotp
                ? "Sign in to your workspace"
                : emailMode
                  ? otpSent
                    ? "Enter the code sent to your email"
                    : "Get a sign-in code by email"
                  : "Enter your two-factor code"}
            </p>
          </div>
        </div>

        {needsTotp && emailMode && otpSent ? (
          <form onSubmit={handleEmailVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="code"
                className="block text-sm font-medium text-foreground"
              >
                Email code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                required
                autoComplete="one-time-code"
                placeholder="123456"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Verifying..." : "Verify"}
            </Button>

            <button
              type="button"
              onClick={chooseTotp}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Use an authenticator app instead
            </button>
          </form>
        ) : needsTotp && emailMode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We&apos;ll email a one-time code to the address on your account.
            </p>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Sending..." : "Email me a code"}
            </Button>

            <button
              type="button"
              onClick={chooseTotp}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Use an authenticator app instead
            </button>
          </div>
        ) : needsTotp ? (
          <form onSubmit={handleTotp} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="code"
                className="block text-sm font-medium text-foreground"
              >
                Authentication code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                required
                autoComplete="one-time-code"
                placeholder="123456"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>

            <button
              type="button"
              onClick={chooseEmail}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Email me a code instead
            </button>
          </form>
        ) : (
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="********"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {pending === "password" ? "Signing in..." : "Sign in"}
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handlePasskey}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              Sign in with a passkey
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
