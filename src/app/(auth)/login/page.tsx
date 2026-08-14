"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { signIn, twoFactor } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

// The plugin redirects back with ?error=<code>. Only the codes a real user can
// reach are translated; the rest fall back, and the raw code stays server-side.
const SSO_ERRORS: Record<string, string> = {
  "account not linked": "This company's domain is not verified yet. Ask an administrator to finish the SSO setup.",
  signup_disabled: "No DataShield account exists for this address. Ask an administrator to create it.",
  invalid_provider: "The identity provider rejected the sign-in. Ask an administrator to check the SSO configuration.",
}

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
  // Step one's result. An address whose company runs a verified IdP is routed
  // to it before this is ever set; everyone else lands here and sees the
  // password field exactly as before.
  const [ssoChecked, setSsoChecked] = useState(false)
  // Carried over from step one so the password step's form still posts an
  // email field without asking the user to type it twice.
  const [email, setEmail] = useState("")
  const router = useRouter()

  // The sso plugin sends failures back as /login?error=<code> after a round
  // trip to the IdP, so they show up here rather than from a fetch response.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error")
    if (code) setError(SSO_ERRORS[code] ?? "Single sign-on failed. Try again or contact an administrator.")
  }, [])

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

  // Step one: an email alone. An address whose company runs a verified IdP
  // never reaches the password field; everyone else sees it after this check.
  // The resolve call is an optimization, not a gate: anything short of a
  // confident "yes, go to this IdP" falls through to the password step, so a
  // network hiccup or a rate limit can never lock someone out of signing in.
  async function continueWithEmail(typedEmail: string) {
    setEmail(typedEmail)
    setPending("password")
    setError(null)

    let resolved: { sso?: boolean; providerId?: string } | null = null
    try {
      const res = await fetch("/api/sso/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: typedEmail }),
      })
      if (res.ok) resolved = (await res.json()) as { sso?: boolean; providerId?: string }
    } catch {
      // Network failure: treated exactly like "no SSO configured" below.
      resolved = null
    }

    if (resolved?.sso && resolved.providerId) {
      const { error: ssoError } = await signIn.sso({
        providerId: resolved.providerId,
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      })
      if (ssoError) {
        // The lookup was confident but starting the redirect itself failed
        // (for example the provider was just removed). Fall back to the
        // password step instead of leaving the user stuck on a dead end;
        // the server enforces the real policy either way.
        setError("Single sign-on failed. Try again or contact an administrator.")
        setSsoChecked(true)
        setPending(null)
        return
      }
      // Success navigates the whole page away to the IdP; nothing left to do.
      return
    }

    setSsoChecked(true)
    setPending(null)
  }

  async function handleContinue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await continueWithEmail(String(form.get("email")))
  }

  function backToEmail() {
    setError(null)
    setSsoChecked(false)
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
      setError(
        // The middleware answers FORBIDDEN when the company mandates SSO and
        // this user is not exempt (including while its provider's domain is
        // still unverified). A plain "invalid email or password" would send
        // them looking for a typo that is not there.
        error.status === 403
          ? "Your company requires signing in through its identity provider. Ask an administrator if you cannot reach it."
          : "Invalid email or password"
      )
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
          // method="post": before hydration, Enter in this form would fall back
          // to a native GET submit, putting the one-time code in the URL,
          // browser history, and request logs.
          <form onSubmit={handleEmailVerify} method="post" className="space-y-4">
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
          // method="post": same fallback risk as above, again for a one-time code.
          <form onSubmit={handleTotp} method="post" className="space-y-4">
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
        ) : !ssoChecked ? (
          // Step one: email only. method="post" because before hydration, Enter
          // in this single-field form would otherwise fall back to a native GET
          // submit, putting the typed email in the URL, browser history, and
          // request logs.
          <form onSubmit={handleContinue} method="post" className="space-y-4">
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
                autoFocus
                placeholder="you@company.com"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {pending === "password" ? "Checking..." : "Continue"}
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
        ) : (
          // Step two: password. Same method="post" fallback risk as step one,
          // now for a password rather than just an email.
          <form onSubmit={handlePassword} method="post" className="space-y-4">
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
                readOnly
                defaultValue={email}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
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
                autoFocus
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

            <button
              type="button"
              onClick={backToEmail}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
