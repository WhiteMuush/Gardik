"use client"

import { useState } from "react"
import { X, ChevronRight, CheckCircle, XCircle, Loader2, Building2, Globe, Network, Eye, EyeOff, Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DirectoryType = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY"

type ProviderOption = {
  type: DirectoryType
  label: string
  description: string
  icon: React.ReactNode
  docsUrl: string
}

const PROVIDERS: ProviderOption[] = [
  {
    type: "AZURE_AD",
    label: "Microsoft Azure AD / Entra ID",
    description: "Microsoft 365, Entra ID, hybrid on-prem",
    icon: <Building2 className="size-5" />,
    docsUrl: "https://learn.microsoft.com/fr-fr/entra/identity/",
  },
  {
    type: "GOOGLE_WORKSPACE",
    label: "Google Workspace",
    description: "Gmail, Google Workspace Business / Enterprise",
    icon: <Globe className="size-5" />,
    docsUrl: "https://developers.google.com/workspace/admin/directory/reference/rest",
  },
  {
    type: "LDAP",
    label: "LDAP / Active Directory",
    description: "OpenLDAP, on-premise Active Directory, FreeIPA",
    icon: <Network className="size-5" />,
    docsUrl: "",
  },
  {
    type: "AWS_DIRECTORY",
    label: "AWS IAM Identity Center",
    description: "AWS Directory Service, AWS SSO, Managed Microsoft AD",
    icon: <Cloud className="size-5" />,
    docsUrl: "https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html",
  },
]

type FieldDef = {
  key: string
  label: string
  placeholder?: string
  type?: "text" | "password" | "number" | "textarea"
  secret?: boolean
  hint?: string
}

const FIELDS: Record<DirectoryType, FieldDef[]> = {
  AZURE_AD: [
    {
      key: "tenantId",
      label: "Tenant ID",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      hint: "Azure portal > Microsoft Entra ID > Properties > Tenant ID",
    },
    {
      key: "clientId",
      label: "Client ID (App Registration)",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      hint: "Azure portal > App registrations > your app > Application (client) ID",
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      placeholder: "Your application secret",
      type: "password",
      hint: "Required permission: User.Read.All (Application)",
    },
  ],
  GOOGLE_WORKSPACE: [
    {
      key: "serviceAccountEmail",
      label: "Service account email",
      placeholder: "datashield@my-project.iam.gserviceaccount.com",
      hint: "Google Cloud Console > IAM > Service accounts",
    },
    {
      key: "privateKey",
      label: "Private key (RSA)",
      type: "textarea",
      secret: true,
      placeholder: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
      hint: "Service account JSON file > private_key field",
    },
    {
      key: "delegatedAdminEmail",
      label: "Delegated admin email",
      placeholder: "admin@yourdomain.com",
      hint: "Google Workspace admin account used for domain-wide delegation",
    },
    {
      key: "domain",
      label: "Domain",
      placeholder: "yourdomain.com",
      hint: "Primary domain of your Google Workspace",
    },
  ],
  AWS_DIRECTORY: [
    {
      key: "accessKeyId",
      label: "Access Key ID",
      placeholder: "AKIAIOSFODNN7EXAMPLE",
      hint: "IAM user with identitystore:ListUsers permission",
    },
    {
      key: "secretAccessKey",
      label: "Secret Access Key",
      type: "password" as const,
      placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    },
    {
      key: "region",
      label: "Region",
      placeholder: "us-east-1",
      hint: "AWS region where IAM Identity Center is configured",
    },
    {
      key: "identityStoreId",
      label: "Identity Store ID",
      placeholder: "d-1234567890",
      hint: "IAM Identity Center console > Settings > Identity store ID",
    },
  ],
  LDAP: [
    {
      key: "host",
      label: "Host",
      placeholder: "ldap.company.com",
      hint: "IP address or hostname of your LDAP server",
    },
    {
      key: "port",
      label: "Port",
      type: "number",
      placeholder: "389 or 636 (LDAPS)",
    },
    {
      key: "ssl",
      label: "SSL/TLS (LDAPS)",
      placeholder: "true",
      hint: "Recommended: use port 636 with SSL enabled",
    },
    {
      key: "bindDN",
      label: "Bind DN",
      placeholder: "cn=readonly,dc=company,dc=com",
      hint: "Read-only account used for LDAP authentication",
    },
    {
      key: "bindPassword",
      label: "Bind password",
      type: "password",
      placeholder: "LDAP account password",
    },
    {
      key: "baseDN",
      label: "Base DN",
      placeholder: "dc=company,dc=com",
      hint: "Root of the LDAP search tree",
    },
    {
      key: "userFilter",
      label: "User filter",
      placeholder: "(&(objectClass=person)(mail=*))",
      hint: "LDAP filter to select active user accounts",
    },
  ],
}

type Props = {
  onClose: () => void
  onCreated: (conn: unknown) => void
}

type TestResult = { ok: boolean; userCount?: number; error?: string }

export function ConnectWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<"choose" | "configure" | "test" | "done">("choose")
  const [selectedType, setSelectedType] = useState<DirectoryType | null>(null)
  const [name, setName] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set())

  function toggleReveal(key: string) {
    setRevealedFields((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const fieldDefs = selectedType ? FIELDS[selectedType] : []

  function handleFieldChange(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function buildConfig() {
    const cfg: Record<string, unknown> = {}
    for (const def of fieldDefs) {
      if (def.type === "number") cfg[def.key] = parseInt(fields[def.key] ?? "0", 10)
      else if (def.key === "ssl") cfg[def.key] = fields[def.key] === "true"
      else cfg[def.key] = fields[def.key] ?? ""
    }
    return cfg
  }

  async function handleSave() {
    if (!selectedType || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, name: name.trim(), config: buildConfig() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const conn = await res.json()
      setCreatedId(conn.id)
      setStep("test")
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!createdId) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/directory/${createdId}/test`, { method: "POST" })
      const result = await res.json()
      setTestResult(result)
      if (result.ok) setStep("done")
    } finally {
      setTesting(false)
    }
  }

  function handleFinish() {
    onCreated({ id: createdId, type: selectedType, name, status: testResult?.ok ? "ACTIVE" : "PENDING" })
    onClose()
  }

  const provider = PROVIDERS.find((p) => p.type === selectedType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {step === "choose" && "Connect a directory"}
            {step === "configure" && `Configure ${provider?.label}`}
            {step === "test" && "Test connection"}
            {step === "done" && "Connection successful"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === "choose" && (
            <div className="space-y-2">
              <p className="mb-4 text-sm text-muted-foreground">
                Choose the type of directory to connect.
              </p>
              {PROVIDERS.map((p) => (
                <button
                  key={p.type}
                  onClick={() => {
                    setSelectedType(p.type)
                    setFields({})
                    setName("")
                    setStep("configure")
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    {p.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {step === "configure" && selectedType && (
            <div className="space-y-4">
              {provider?.docsUrl && (
                <p className="text-xs text-muted-foreground">
                  Need help?{" "}
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Official documentation
                  </a>
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Connection name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${provider?.label} Production`}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {fieldDefs.map((def) => (
                <div key={def.key}>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    {def.label}
                  </label>
                  {def.type === "textarea" ? (
                    <div className="relative">
                      <textarea
                        value={fields[def.key] ?? ""}
                        onChange={(e) => handleFieldChange(def.key, e.target.value)}
                        placeholder={def.placeholder}
                        rows={4}
                        style={def.secret && !revealedFields.has(def.key) ? { WebkitTextSecurity: "disc" } as React.CSSProperties : undefined}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {def.secret && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(def.key)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {revealedFields.has(def.key) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      )}
                    </div>
                  ) : (
                    <input
                      type={def.type ?? "text"}
                      value={fields[def.key] ?? ""}
                      onChange={(e) => handleFieldChange(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                  {def.hint && (
                    <p className="mt-1 text-xs text-muted-foreground">{def.hint}</p>
                  )}
                </div>
              ))}

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}

          {step === "test" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connection saved. Test it now to verify that DataShield can reach your directory.
              </p>

              {testResult && (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-4 py-3",
                    testResult.ok
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-destructive/30 bg-destructive/10"
                  )}
                >
                  {testResult.ok ? (
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className={cn("text-sm font-medium", testResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                      {testResult.ok ? "Connection successful" : "Connection failed"}
                    </p>
                    {testResult.ok && testResult.userCount !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        {testResult.userCount} user{testResult.userCount !== 1 ? "s" : ""} detected
                      </p>
                    )}
                    {testResult.error && (
                      <p className="text-xs text-muted-foreground">{testResult.error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                <CheckCircle className="size-5 shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Directory connected successfully
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testResult?.userCount !== undefined &&
                      `${testResult.userCount} users ready to sync.`}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Run a sync from the Settings page to import your employees into DataShield.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === "choose" ? onClose : () => setStep(step === "configure" ? "choose" : "configure")}
            disabled={step === "done"}
          >
            {step === "choose" ? "Cancel" : "Back"}
          </Button>

          <div className="flex gap-2">
            {step === "configure" && (
              <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Save
              </Button>
            )}
            {step === "test" && !testResult?.ok && (
              <Button size="sm" onClick={handleTest} disabled={testing}>
                {testing && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Test connection
              </Button>
            )}
            {step === "test" && testResult && !testResult.ok && (
              <Button variant="outline" size="sm" onClick={handleFinish}>
                Skip and finish
              </Button>
            )}
            {step === "done" && (
              <Button size="sm" onClick={handleFinish}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
