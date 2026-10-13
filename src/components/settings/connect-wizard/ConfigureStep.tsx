"use client"

import { Eye, EyeOff } from "lucide-react"
import type { DirectoryType, ProviderOption } from "./providers"
import type { FieldDef } from "./fields"

type Props = {
  selectedType: DirectoryType
  provider: ProviderOption | undefined
  fieldDefs: FieldDef[]
  name: string
  onNameChange: (name: string) => void
  fields: Record<string, string>
  onFieldChange: (key: string, value: string) => void
  revealedFields: Set<string>
  onToggleReveal: (key: string) => void
  error: string | null
}

export function ConfigureStep({
  selectedType,
  provider,
  fieldDefs,
  name,
  onNameChange,
  fields,
  onFieldChange,
  revealedFields,
  onToggleReveal,
  error,
}: Props) {
  if (selectedType === "SCIM") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Gardik will generate a unique endpoint URL and bearer token. You will configure your identity
          provider with these values after saving.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Connection name</label>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Okta SCIM, JumpCloud, OVH..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    )
  }
  return (
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
        <label className="mb-1 block text-xs font-medium text-foreground">Connection name</label>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={`e.g. ${provider?.label} Production`}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {fieldDefs.map((def) => (
        <div key={def.key}>
          <label className="mb-1 block text-xs font-medium text-foreground">{def.label}</label>
          {def.type === "textarea" ? (
            <div className="relative">
              <textarea
                value={fields[def.key] ?? ""}
                onChange={(e) => onFieldChange(def.key, e.target.value)}
                placeholder={def.placeholder}
                rows={4}
                style={
                  def.secret && !revealedFields.has(def.key)
                    ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties)
                    : undefined
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {def.secret && (
                <button
                  type="button"
                  onClick={() => onToggleReveal(def.key)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {revealedFields.has(def.key) ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              )}
            </div>
          ) : (
            <input
              type={def.type ?? "text"}
              value={fields[def.key] ?? ""}
              onChange={(e) => onFieldChange(def.key, e.target.value)}
              placeholder={def.placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {def.hint && <p className="mt-1 text-xs text-muted-foreground">{def.hint}</p>}
        </div>
      ))}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
