"use client"

import type { FormEvent, RefObject } from "react"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import type { Pending } from "./useLoginFlow"

// Every form posts with method="post", so Enter before hydration never puts a secret in the URL.

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
const linkClass = "w-full text-sm text-muted-foreground hover:text-foreground transition-colors"

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-destructive">{error}</p> : null
}

export function CodeForm(props: {
  label: string
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  loading: boolean
  error: string | null
  switchLabel: string
  onSwitch: () => void
}) {
  return (
    <form onSubmit={props.onSubmit} method="post" className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="code" className="block text-sm font-medium text-foreground">
          {props.label}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          required
          autoComplete="one-time-code"
          placeholder="123456"
          className={inputClass}
        />
      </div>
      <ErrorLine error={props.error} />
      <Button type="submit" disabled={props.loading} className="w-full" size="lg">
        {props.loading ? "Verifying..." : "Verify"}
      </Button>
      <button type="button" onClick={props.onSwitch} className={linkClass}>
        {props.switchLabel}
      </button>
    </form>
  )
}

export function EmailCodeRequest(props: {
  onSend: () => void
  loading: boolean
  error: string | null
  onSwitch: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We&apos;ll email a one-time code to the address on your account.
      </p>
      <ErrorLine error={props.error} />
      <Button type="button" onClick={props.onSend} disabled={props.loading} className="w-full" size="lg">
        {props.loading ? "Sending..." : "Email me a code"}
      </Button>
      <button type="button" onClick={props.onSwitch} className={linkClass}>
        Use an authenticator app instead
      </button>
    </div>
  )
}

export function EmailStep({
  onSubmit,
  inputRef,
  defaultEmail,
  pending,
  error,
  onPasskey,
  onPasswordInstead,
}: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  inputRef: RefObject<HTMLInputElement | null>
  defaultEmail: string
  pending: Pending
  error: string | null
  onPasskey: () => void
  onPasswordInstead: () => void
}) {
  const loading = pending !== null
  return (
    <form onSubmit={onSubmit} method="post" className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
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
          defaultValue={defaultEmail}
          ref={inputRef}
          className={inputClass}
        />
      </div>
      <ErrorLine error={error} />
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
        onClick={onPasskey}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        Sign in with a passkey
      </Button>
      <button type="button" onClick={onPasswordInstead} disabled={loading} className={linkClass}>
        Use a password instead
      </button>
    </form>
  )
}

export function PasswordStep(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  email: string
  pending: Pending
  error: string | null
  onBack: () => void
}) {
  return (
    <form onSubmit={props.onSubmit} method="post" className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          readOnly
          defaultValue={props.email}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          autoFocus
          placeholder="********"
          className={inputClass}
        />
      </div>
      <ErrorLine error={props.error} />
      <Button type="submit" disabled={props.pending !== null} className="w-full" size="lg">
        {props.pending === "password" ? "Signing in..." : "Sign in"}
      </Button>
      <button type="button" onClick={props.onBack} className={linkClass}>
        Use a different email
      </button>
    </form>
  )
}
