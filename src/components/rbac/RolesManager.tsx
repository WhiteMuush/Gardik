"use client"

import { useEffect, useMemo, useState } from "react"
import { PermissionEditor } from "./PermissionEditor"
import { StepUpDialog } from "./StepUpDialog"

type Role = {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  isAssignable: boolean
}

const PAGE_SIZE = 8

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([])
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Role | null>(null)
  // Explicit, because a new role starts with no name and no permissions, so
  // the form's own fields cannot tell "closed" from "creating".
  const [formOpen, setFormOpen] = useState(false)
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [stepUpRetry, setStepUpRetry] = useState<null | (() => void)>(null)

  async function load() {
    const res = await fetch("/api/roles")
    if (res.ok) setRoles((await res.json()).roles)
  }
  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(
    () => roles.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [roles, query],
  )
  const pageRoles = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function startEdit(role: Role | null) {
    setEditing(role)
    setName(role?.name ?? "")
    setPerms(new Set(role?.permissions ?? []))
    setError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setEditing(null)
    setName("")
    setPerms(new Set())
    setError(null)
    setFormOpen(false)
  }

  // Runs a mutation; on STEP_UP_REQUIRED it stashes the retry and opens the
  // dialog, replaying the same call once the password is re-verified.
  async function mutate(run: () => Promise<Response>) {
    const res = await run()
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      if (body.code === "STEP_UP_REQUIRED") {
        setStepUpRetry(() => () => void mutate(run))
        return
      }
      setError(body.error ?? "Forbidden")
      return
    }
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed")
      return
    }
    closeForm()
    setStepUpRetry(null)
    await load()
  }

  async function save() {
    const payload = { name, permissions: [...perms] }
    if (editing) {
      await mutate(() =>
        fetch(`/api/roles/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      )
    } else {
      await mutate(() =>
        fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      )
    }
  }

  async function remove(role: Role) {
    if (!confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return
    await mutate(() => fetch(`/api/roles/${role.id}`, { method: "DELETE" }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          placeholder="Search roles"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          onClick={() => startEdit(null)}
          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          New role
        </button>
      </div>

      <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
        {pageRoles.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div>
              <span className="text-foreground">{r.name}</span>
              {r.isSystem && <span className="ml-2 text-xs text-muted-foreground">(system)</span>}
              <span className="ml-2 text-xs text-muted-foreground">
                {r.permissions.length} permissions
              </span>
            </div>
            {!r.isSystem && (
              <div className="flex gap-3 text-xs">
                <button onClick={() => startEdit(r)} className="text-muted-foreground hover:text-foreground">
                  Edit
                </button>
                <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive">
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} role(s), page {page + 1} of {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
            Prev
          </button>
          <button
            disabled={(page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <input
            placeholder="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <PermissionEditor selected={perms} onChange={setPerms} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="text-sm text-muted-foreground">
              Cancel
            </button>
            <button onClick={save} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              Save
            </button>
          </div>
        </div>
      )}

      <StepUpDialog
        open={stepUpRetry !== null}
        onVerified={() => stepUpRetry?.()}
        onCancel={() => setStepUpRetry(null)}
      />
    </div>
  )
}
