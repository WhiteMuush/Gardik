"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SsoProvider = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  discoveryEndpoint: string | null
  clientIdLastFour: string | null
}

type DnsRecord = { name: string; value: string }

type StatusMessage = { kind: "error" | "success"; text: string } | null

type FormState = {
  issuer: string
  domain: string
  clientId: string
  clientSecret: string
  discoveryEndpoint: string
}

const EMPTY_FORM: FormState = {
  issuer: "",
  domain: "",
  clientId: "",
  clientSecret: "",
  discoveryEndpoint: "",
}

type Action = "save" | "record" | "verify" | "remove" | null

type Props = {
  // sso:read is checked server-side before this component is mounted. This flag
  // reflects sso:config so a read-only admin sees the configuration without
  // being offered controls the API will refuse.
  canConfigure: boolean
}

export function SsoSettings({ canConfigure }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [provider, setProvider] = useState<SsoProvider | null>(null)
  const [record, setRecord] = useState<DnsRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = useState<StatusMessage>(null)
  const [action, setAction] = useState<Action>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/sso/provider")
      const data = (await res.json()) as { provider?: SsoProvider | null; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Could not load the SSO configuration")
      setProvider(data.provider ?? null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the SSO configuration")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!provider) return
    setForm({
      issuer: provider.issuer,
      domain: provider.domain,
      discoveryEndpoint: provider.discoveryEndpoint ?? "",
      clientId: "",
      clientSecret: "",
    })
    setStatus(null)
    setRecord(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setForm(EMPTY_FORM)
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAction("save")
    setStatus(null)

    const trimmed: Record<string, string> = {
      issuer: form.issuer.trim(),
      domain: form.domain.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret.trim(),
      discoveryEndpoint: form.discoveryEndpoint.trim(),
    }
    // PATCH treats every field as optional and keeps the current value when a
    // field is omitted, so only send what the admin actually typed. POST
    // requires the full set, so send it as-is and let the API validate it.
    const body: Record<string, string> = provider
      ? Object.fromEntries(Object.entries(trimmed).filter(([, v]) => v.length > 0))
      : trimmed

    try {
      const res = await fetch("/api/sso/provider", {
        method: provider ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { provider?: SsoProvider | null; error?: string }
      if (!res.ok) {
        setStatus({ kind: "error", text: data.error ?? "Could not save the configuration" })
        return
      }
      const wasUpdate = provider !== null
      setProvider(data.provider ?? null)
      setRecord(null)
      setForm(EMPTY_FORM)
      setEditing(false)
      setStatus({
        kind: "success",
        text: wasUpdate
          ? "Configuration updated."
          : "Provider connected. Publish the DNS record and verify the domain before members can sign in.",
      })
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not save the configuration",
      })
    } finally {
      setAction(null)
    }
  }

  async function requestRecord() {
    setAction("record")
    setStatus(null)
    try {
      const res = await fetch("/api/sso/provider/domain", { method: "POST" })
      const data = (await res.json()) as { record?: DnsRecord; error?: string }
      if (!res.ok) {
        setStatus({ kind: "error", text: data.error ?? "Could not start verification" })
        return
      }
      setRecord(data.record ?? null)
      setStatus({
        kind: "success",
        text: "DNS record generated below. Publish it with your registrar, then verify.",
      })
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not start verification",
      })
    } finally {
      setAction(null)
    }
  }

  async function verify() {
    setAction("verify")
    setStatus(null)
    try {
      const res = await fetch("/api/sso/provider/domain", { method: "PUT" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setStatus({ kind: "error", text: data.error ?? "Verification failed" })
        return
      }
      setProvider((p) => (p ? { ...p, domainVerified: true } : p))
      setRecord(null)
      setStatus({
        kind: "success",
        text: "Domain verified. Members of this domain can now sign in through the provider.",
      })
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Verification failed",
      })
    } finally {
      setAction(null)
    }
  }

  async function removeProvider() {
    if (
      !window.confirm(
        "Disconnect the identity provider? Members will no longer be able to sign in through it."
      )
    ) {
      return
    }
    setAction("remove")
    setStatus(null)
    try {
      const res = await fetch("/api/sso/provider", { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus({ kind: "error", text: data.error ?? "Could not remove the provider" })
        return
      }
      setProvider(null)
      setRecord(null)
      setEditing(false)
      setStatus({ kind: "success", text: "Identity provider disconnected." })
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not remove the provider",
      })
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Single sign-on (OIDC)</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Connect the company identity provider. Sign-in through it stays disabled until the domain
        is verified.
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
          <div className="rounded-lg border border-border px-3 py-3 text-xs">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Issuer</dt>
                <dd className="truncate text-foreground">{provider.issuer}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email domain</dt>
                <dd className="text-foreground">{provider.domain}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Discovery endpoint</dt>
                <dd className="truncate text-foreground">{provider.discoveryEndpoint ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Client ID</dt>
                <dd className="text-foreground">
                  {provider.clientIdLastFour ? `...${provider.clientIdLastFour}` : "-"}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
              {provider.domainVerified ? (
                <>
                  <CheckCircle2 className="size-3.5 shrink-0 text-severity-ok" />
                  <span className="font-medium text-severity-ok">Domain verified</span>
                  <span className="text-muted-foreground">
                    Members of {provider.domain} can sign in through this provider.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5 shrink-0 text-severity-critical" />
                  <span className="font-medium text-severity-critical">Domain not verified</span>
                  <span className="text-muted-foreground">
                    Sign-in through this provider is disabled until it is.
                  </span>
                </>
              )}
            </div>
          </div>

          {!provider.domainVerified && canConfigure && (
            <div className="rounded-lg border border-border px-3 py-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Publish a DNS TXT record proving ownership of {provider.domain}, then verify it.
                DNS propagation can take up to an hour.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestRecord}
                  disabled={action !== null}
                >
                  {action === "record" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Get DNS record
                </Button>
                <Button type="button" size="sm" onClick={verify} disabled={action !== null}>
                  {action === "verify" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Verify domain
                </Button>
              </div>
              {record && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-foreground">DNS TXT record</p>
                  <code className="block overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                    TXT {record.name} {record.value}
                  </code>
                </div>
              )}
            </div>
          )}

          {!provider.domainVerified && !canConfigure && (
            <p className="text-xs text-muted-foreground">
              Ask an administrator with SSO configuration access to publish the DNS record and
              verify the domain.
            </p>
          )}

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

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: "text" | "password"
}

function Field({ label, value, onChange, placeholder, required, type = "text" }: FieldProps) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

type FormProps = {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  pending: boolean
  disabled: boolean
}

function ConnectForm({ form, setForm, onSubmit, pending, disabled }: FormProps) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Issuer URL"
        required
        value={form.issuer}
        onChange={(v) => setForm((f) => ({ ...f, issuer: v }))}
        placeholder="https://idp.example.com"
      />
      <Field
        label="Discovery endpoint"
        required
        value={form.discoveryEndpoint}
        onChange={(v) => setForm((f) => ({ ...f, discoveryEndpoint: v }))}
        placeholder="https://idp.example.com/.well-known/openid-configuration"
      />
      <Field
        label="Email domain"
        required
        value={form.domain}
        onChange={(v) => setForm((f) => ({ ...f, domain: v }))}
        placeholder="example.com"
      />
      <Field
        label="Client ID"
        required
        value={form.clientId}
        onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
      />
      <Field
        label="Client secret"
        required
        type="password"
        value={form.clientSecret}
        onChange={(v) => setForm((f) => ({ ...f, clientSecret: v }))}
      />
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" disabled={disabled}>
          {pending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {pending ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </form>
  )
}

function EditForm({
  form,
  setForm,
  onSubmit,
  pending,
  disabled,
  clientIdLastFour,
}: FormProps & { clientIdLastFour: string | null }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <Field
        label="Issuer URL"
        value={form.issuer}
        onChange={(v) => setForm((f) => ({ ...f, issuer: v }))}
      />
      <Field
        label="Discovery endpoint"
        value={form.discoveryEndpoint}
        onChange={(v) => setForm((f) => ({ ...f, discoveryEndpoint: v }))}
      />
      <Field
        label="Email domain"
        value={form.domain}
        onChange={(v) => setForm((f) => ({ ...f, domain: v }))}
      />
      <Field
        label="Client ID"
        value={form.clientId}
        onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
        placeholder={clientIdLastFour ? `Leave blank to keep ...${clientIdLastFour}` : "Leave blank to keep current"}
      />
      <Field
        label="Client secret"
        type="password"
        value={form.clientSecret}
        onChange={(v) => setForm((f) => ({ ...f, clientSecret: v }))}
        placeholder="Leave blank to keep current secret"
      />
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" disabled={disabled}>
          {pending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}
