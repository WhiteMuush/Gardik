"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, twoFactor } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsTotp, setNeedsTotp] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const router = useRouter()

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

  async function handleSendOtp() {
    setLoading(true)
    setError(null)

    const { error } = await twoFactor.sendOtp()

    setLoading(false)

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
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const { error } = await twoFactor.verifyOtp({
      code: String(form.get("code")),
    })

    setLoading(false)

    if (error) {
      setError("Invalid code")
      return
    }

    router.push("/dashboard")
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const { data, error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })

    setLoading(false)

    if (error) {
      setError("Invalid email or password")
      return
    }

    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsTotp(true)
      return
    }

    router.push("/dashboard")
  }

  async function handleTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const { error } = await twoFactor.verifyTotp({
      code: String(form.get("code")),
    })

    setLoading(false)

    if (error) {
      setError("Invalid code")
      return
    }

    router.push("/dashboard")
  }

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
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
