"use client"

import { Loader2 } from "lucide-react"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import type { FormState } from "./types"

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
      {type === "password" ? (
        <PasswordInput
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
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

export function ConnectForm({ form, setForm, onSubmit, pending, disabled }: FormProps) {
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

export function EditForm({
  form,
  setForm,
  onSubmit,
  pending,
  disabled,
  clientIdLastFour,
}: FormProps & { clientIdLastFour: string | null }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <Field label="Issuer URL" value={form.issuer} onChange={(v) => setForm((f) => ({ ...f, issuer: v }))} />
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
        placeholder={
          clientIdLastFour ? `Leave blank to keep ...${clientIdLastFour}` : "Leave blank to keep current"
        }
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
