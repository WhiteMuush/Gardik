"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
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
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search roles"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <button
          onClick={() => startEdit(null)}
          className="ml-auto rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          New role
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Permissions
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRoles.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                  No roles match this search
                </td>
              </tr>
            ) : (
              pageRoles.map((r) => (
                <tr key={r.id} className="group transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{r.name}</span>
                    {r.isSystem && (
                      <span className="ml-2 text-xs text-muted-foreground">Built-in</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {r.permissions.length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.isSystem ? (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    ) : (
                      <div className="flex justify-end gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} role{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {page + 1} / {pages}
            </span>
            <button
              disabled={(page + 1) * PAGE_SIZE >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {formOpen && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {editing ? `Edit ${editing.name}` : "New role"}
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {perms.size} selected
            </span>
          </div>

          <input
            placeholder="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />

          <PermissionEditor selected={perms} onChange={setPerms} />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              onClick={closeForm}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90"
            >
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
