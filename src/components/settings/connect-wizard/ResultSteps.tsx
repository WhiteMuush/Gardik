"use client"

import { CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type TestResult = { ok: boolean; userCount?: number; error?: string }

export function TestStep({ testResult }: { testResult: TestResult | null }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connection saved. Test it now to verify that Gardik can reach your directory.
      </p>

      {testResult && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3",
            testResult.ok ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"
          )}
        >
          {testResult.ok ? (
            <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <div>
            <p
              className={cn(
                "text-sm font-medium",
                testResult.ok ? "text-severity-ok-fg" : "text-destructive"
              )}
            >
              {testResult.ok ? "Connection successful" : "Connection failed"}
            </p>
            {testResult.ok && testResult.userCount !== undefined && (
              <p className="text-xs text-muted-foreground">
                {testResult.userCount} user{testResult.userCount !== 1 ? "s" : ""} detected
              </p>
            )}
            {testResult.error && <p className="text-xs text-muted-foreground">{testResult.error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function DoneStep({
  isScim,
  testResult,
  createdId,
  scimToken,
}: {
  isScim: boolean
  testResult: TestResult | null
  createdId: string | null
  scimToken: string | null
}) {
  if (!isScim) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle className="size-5 shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-medium text-severity-ok-fg">Directory connected successfully</p>
            <p className="text-xs text-muted-foreground">
              {testResult?.userCount !== undefined && `${testResult.userCount} users ready to sync.`}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Run a sync from the Settings page to import your employees into Gardik.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
        <CheckCircle className="size-5 shrink-0 text-green-500" />
        <p className="text-sm font-medium text-severity-ok-fg">SCIM endpoint ready</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure your identity provider with the values below. The bearer token is only shown once.
      </p>
      <div>
        <p className="mb-1 text-xs font-medium text-foreground">SCIM endpoint URL</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <code className="flex-1 truncate font-mono text-xs text-foreground">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/scim/{createdId}/Users
          </code>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-foreground">Bearer token</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <code className="flex-1 truncate font-mono text-xs text-foreground">{scimToken}</code>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Copy this token now, it will not be shown again.</p>
      </div>
    </div>
  )
}
