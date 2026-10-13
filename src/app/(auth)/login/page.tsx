"use client"

import { use } from "react"
import { EnteringWorkspace } from "./EnteringWorkspace"
import { CodeForm, EmailCodeRequest, EmailStep, PasswordStep } from "./login-forms"
import { useLoginFlow } from "./useLoginFlow"

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  // The SSO plugin reports IdP failures as /login?error=<code> after the round trip.
  const { error: ssoCode } = use(searchParams)
  const flow = useLoginFlow(ssoCode)

  if (flow.entering) return <EnteringWorkspace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gardik</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {!flow.needsTotp
                ? "Sign in to your workspace"
                : flow.emailMode
                  ? flow.otpSent
                    ? "Enter the code sent to your email"
                    : "Get a sign-in code by email"
                  : "Enter your two-factor code"}
            </p>
          </div>
        </div>

        {flow.needsTotp && flow.emailMode && flow.otpSent ? (
          <CodeForm
            label="Email code"
            onSubmit={flow.handleEmailVerify}
            loading={flow.loading}
            error={flow.error}
            switchLabel="Use an authenticator app instead"
            onSwitch={flow.chooseTotp}
          />
        ) : flow.needsTotp && flow.emailMode ? (
          <EmailCodeRequest
            onSend={flow.handleSendOtp}
            loading={flow.loading}
            error={flow.error}
            onSwitch={flow.chooseTotp}
          />
        ) : flow.needsTotp ? (
          <CodeForm
            label="Authentication code"
            onSubmit={flow.handleTotp}
            loading={flow.loading}
            error={flow.error}
            switchLabel="Email me a code instead"
            onSwitch={flow.chooseEmail}
          />
        ) : !flow.ssoChecked ? (
          <EmailStep
            onSubmit={flow.handleContinue}
            inputRef={flow.emailInputRef}
            defaultEmail={flow.email}
            pending={flow.pending}
            error={flow.error}
            onPasskey={flow.handlePasskey}
            onPasswordInstead={flow.usePasswordInstead}
          />
        ) : (
          <PasswordStep
            onSubmit={flow.handlePassword}
            email={flow.email}
            pending={flow.pending}
            error={flow.error}
            onBack={flow.backToEmail}
          />
        )}
      </div>
    </div>
  )
}
