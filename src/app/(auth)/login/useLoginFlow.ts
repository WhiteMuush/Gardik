"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { signIn, twoFactor } from "@/lib/auth/client"
import { SSO_ERRORS, SSO_FAILED, resolveSso } from "./resolve-sso"

export type Pending = null | "password" | "passkey" | "totp" | "otp"

// Holds every step of the sign-in flow: email, SSO redirect, password, passkey and second factor.
export function useLoginFlow(ssoCode: string | string[] | undefined) {
  const [error, setError] = useState<string | null>(
    typeof ssoCode === "string" ? (SSO_ERRORS[ssoCode] ?? SSO_FAILED) : null
  )
  // The clicked button owns the spinner, and the passkey label never collides with "Sign in".
  const [pending, setPending] = useState<Pending>(null)
  const [entering, setEntering] = useState(false)
  const [needsTotp, setNeedsTotp] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  // An address routed to its company IdP never sets this; everyone else gets the password step.
  const [ssoChecked, setSsoChecked] = useState(false)
  const [email, setEmail] = useState("")
  const emailInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // A bfcache restore after a broken IdP would freeze pending and disable the escape hatch, so it is reset.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setPending(null)
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  // The root picks the first page this role may open, since hardcoding /dashboard refused some roles.
  function enterWorkspace() {
    setEntering(true)
    router.push("/")
  }

  function fail(message: string) {
    setPending(null)
    setError(message)
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

  async function handleContinue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const typedEmail = String(new FormData(e.currentTarget).get("email"))
    setEmail(typedEmail)
    setPending("password")
    setError(null)

    const resolved = await resolveSso(typedEmail)
    if (resolved?.sso && resolved.providerId) {
      const { error: ssoError } = await signIn.sso({
        providerId: resolved.providerId,
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      })
      // On success the page navigates to the IdP; a failed start falls back to the password step.
      if (!ssoError) return
      setError(SSO_FAILED)
    }
    setSsoChecked(true)
    setPending(null)
  }

  function backToEmail() {
    setError(null)
    setSsoChecked(false)
  }

  // Anti-lockout escape hatch: ssoExempt users skip the lookup to reach the password step, the server
  // still enforces the policy, and without it ssoExempt is unreachable, so do not remove it.
  function usePasswordInstead() {
    const input = emailInputRef.current
    if (!input || !input.checkValidity()) {
      input?.reportValidity()
      return
    }
    setError(null)
    setEmail(input.value)
    setSsoChecked(true)
  }

  async function handlePasskey() {
    setPending("passkey")
    setError(null)
    try {
      const res = await signIn.passkey()
      if (res?.error) return fail("Passkey sign-in failed or was cancelled")
      enterWorkspace()
    } catch {
      fail("Passkey sign-in failed or was cancelled")
    }
  }

  async function handleSendOtp() {
    setPending("otp")
    setError(null)
    const { error } = await twoFactor.sendOtp()
    setPending(null)
    if (error) {
      // 403 means the company policy forbids EMAIL_OTP; the server hook is the real guard.
      setError(
        error.status === 403
          ? "Email codes are disabled by your company's policy"
          : "Could not send a code, try again"
      )
      return
    }
    setOtpSent(true)
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>, kind: "otp" | "totp") {
    e.preventDefault()
    setPending(kind)
    setError(null)
    const code = String(new FormData(e.currentTarget).get("code"))
    const { error } =
      kind === "otp" ? await twoFactor.verifyOtp({ code }) : await twoFactor.verifyTotp({ code })
    if (error) return fail("Invalid code")
    enterWorkspace()
  }

  async function handlePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending("password")
    setError(null)
    const form = new FormData(e.currentTarget)
    const { data, error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })
    if (error) {
      // 403 means the company mandates SSO for this user, which a typo message would hide.
      return fail(
        error.status === 403
          ? "Your company requires signing in through its identity provider. Ask an administrator if you cannot reach it."
          : "Invalid email or password"
      )
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setPending(null)
      setNeedsTotp(true)
      return
    }
    enterWorkspace()
  }

  return {
    error,
    pending,
    loading: pending !== null,
    entering,
    needsTotp,
    emailMode,
    otpSent,
    ssoChecked,
    email,
    emailInputRef,
    chooseEmail,
    chooseTotp,
    handleContinue,
    backToEmail,
    usePasswordInstead,
    handlePasskey,
    handleSendOtp,
    handleEmailVerify: (e: FormEvent<HTMLFormElement>) => verifyCode(e, "otp"),
    handleTotp: (e: FormEvent<HTMLFormElement>) => verifyCode(e, "totp"),
    handlePassword,
  }
}
