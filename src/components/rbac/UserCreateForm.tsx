"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

// grantable is the server's own answer to "would you accept this from me",
// so the picker cannot offer a role the write path will refuse.
type Role = { id: string; name: string; isAssignable: boolean; grantable: boolean }

export function UserCreateForm() {
  const [roles, setRoles] = useState<Role[]>([])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [roleId, setRoleId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d: { roles?: Role[] }) => setRoles(d.roles ?? []))
      .catch(() => setRoles([]))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, roleId }),
    })
    const data = (await res.json()) as { error?: string }
    setPending(false)
    if (!res.ok) {
      setMessage(data.error ?? "Could not create the account")
      return
    }
    setEmail("")
    setName("")
    setMessage("Account created. It signs in through the company identity provider.")
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-lg border border-border p-4">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Add a person</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Creates an SSO-only account. It can sign in once this company has a verified identity provider.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@company.com"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          required
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Role</option>
          {roles
            .filter((r) => r.grantable)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create"}
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </form>
  )
}
