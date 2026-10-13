"use client"

import { KeyRound, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSsoProvider } from "./sso/useSsoProvider"
import { ConnectForm, EditForm } from "./sso/forms"
import { ProviderDetails } from "./sso/ProviderDetails"

type Props = {
  // sso:read is checked before mounting; this flag hides controls a read-only admin would be refused.
  canConfigure: boolean
}

export function SsoSettings({ canConfigure }: Props) {
  const {
    loading,
    loadError,
    provider,
    record,
    editing,
    form,
    setForm,
    status,
    action,
    load,
    startEdit,
    cancelEdit,
    save,
    requestRecord,
    verify,
    removeProvider,
  } = useSsoProvider()

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Single sign-on (OIDC)</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Connect the company identity provider. Sign-in through it stays disabled until the domain is verified.
      </p>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading SSO configuration...
        </p>
      )}

      {!loading && loadError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-xs text-destructive">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !loadError && !provider && canConfigure && (
        <ConnectForm
          form={form}
          setForm={setForm}
          onSubmit={save}
          pending={action === "save"}
          disabled={action !== null}
        />
      )}

      {!loading && !loadError && !provider && !canConfigure && (
        <p className="text-xs text-muted-foreground">
          No identity provider is configured for this company yet.
        </p>
      )}

      {!loading && !loadError && provider && (
        <div className="space-y-4">
          <ProviderDetails
            provider={provider}
            canConfigure={canConfigure}
            record={record}
            action={action}
            onRequestRecord={requestRecord}
            onVerify={verify}
          />

          {canConfigure && (
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              {editing ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Cancel edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Edit configuration
                </button>
              )}
              <button
                type="button"
                onClick={removeProvider}
                disabled={action !== null}
                className="text-xs font-medium text-destructive underline-offset-2 hover:underline disabled:opacity-40"
              >
                {action === "remove" ? "Disconnecting..." : "Disconnect provider"}
              </button>
            </div>
          )}

          {editing && canConfigure && (
            <EditForm
              form={form}
              setForm={setForm}
              onSubmit={save}
              pending={action === "save"}
              disabled={action !== null}
              clientIdLastFour={provider.clientIdLastFour}
            />
          )}
        </div>
      )}

      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={cn(
            "mt-3 rounded-md px-3 py-2 text-xs",
            status.kind === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-severity-ok/10 text-severity-ok"
          )}
        >
          {status.text}
        </p>
      )}
    </div>
  )
}
