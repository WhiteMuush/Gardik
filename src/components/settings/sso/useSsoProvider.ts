"use client"

import { useCallback, useEffect, useState } from "react"
import {
  EMPTY_FORM,
  type Action,
  type DnsRecord,
  type FormState,
  type SsoProvider,
  type StatusMessage,
} from "./types"

async function fetchProvider(): Promise<SsoProvider | null> {
  const res = await fetch("/api/sso/provider")
  const data = (await res.json()) as { provider?: SsoProvider | null; error?: string }
  if (!res.ok) throw new Error(data.error ?? "Could not load the SSO configuration")
  return data.provider ?? null
}

// Loads the company SSO provider and runs every change to it, reporting the outcome as a status message.
export function useSsoProvider() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [provider, setProvider] = useState<SsoProvider | null>(null)
  const [record, setRecord] = useState<DnsRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = useState<StatusMessage>(null)
  const [action, setAction] = useState<Action>(null)

  const settle = useCallback(
    (pending: Promise<SsoProvider | null>) =>
      pending
        .then(setProvider, (err) =>
          setLoadError(err instanceof Error ? err.message : "Could not load the SSO configuration")
        )
        .finally(() => setLoading(false)),
    []
  )

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return settle(fetchProvider())
  }, [settle])

  // loading starts true and loadError null, so the first fetch needs no reset.
  useEffect(() => {
    void settle(fetchProvider())
  }, [settle])

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

  // Runs one API call and reports its error, or applies its result and reports success.
  async function run<T>(
    name: Action,
    call: () => Promise<Response>,
    fallback: string,
    onOk: (data: T) => string
  ) {
    setAction(name)
    setStatus(null)
    try {
      const res = await call()
      const data = (await res.json().catch(() => ({}))) as T & { error?: string }
      if (!res.ok) return setStatus({ kind: "error", text: data.error ?? fallback })
      setStatus({ kind: "success", text: onOk(data) })
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : fallback })
    } finally {
      setAction(null)
    }
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed: Record<string, string> = {
      issuer: form.issuer.trim(),
      domain: form.domain.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret.trim(),
      discoveryEndpoint: form.discoveryEndpoint.trim(),
    }
    // PATCH keeps omitted fields, so an update sends only what was typed; POST needs the full set.
    const body: Record<string, string> = provider
      ? Object.fromEntries(Object.entries(trimmed).filter(([, v]) => v.length > 0))
      : trimmed
    const wasUpdate = provider !== null
    return run<{ provider?: SsoProvider | null }>(
      "save",
      () =>
        fetch("/api/sso/provider", {
          method: provider ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      "Could not save the configuration",
      (data) => {
        setProvider(data.provider ?? null)
        setRecord(null)
        setForm(EMPTY_FORM)
        setEditing(false)
        return wasUpdate
          ? "Configuration updated."
          : "Provider connected. Publish the DNS record and verify the domain before members can sign in."
      }
    )
  }

  function requestRecord() {
    return run<{ record?: DnsRecord }>(
      "record",
      () => fetch("/api/sso/provider/domain", { method: "POST" }),
      "Could not start verification",
      (data) => {
        setRecord(data.record ?? null)
        return "DNS record generated below. Publish it with your registrar, then verify."
      }
    )
  }

  function verify() {
    return run(
      "verify",
      () => fetch("/api/sso/provider/domain", { method: "PUT" }),
      "Verification failed",
      () => {
        setProvider((p) => (p ? { ...p, domainVerified: true } : p))
        setRecord(null)
        return "Domain verified. Members of this domain can now sign in through the provider."
      }
    )
  }

  function removeProvider() {
    const question = "Disconnect the identity provider? Members will no longer be able to sign in through it."
    if (!window.confirm(question)) return
    return run(
      "remove",
      () => fetch("/api/sso/provider", { method: "DELETE" }),
      "Could not remove the provider",
      () => {
        setProvider(null)
        setRecord(null)
        setEditing(false)
        return "Identity provider disconnected."
      }
    )
  }

  return {
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
  }
}
