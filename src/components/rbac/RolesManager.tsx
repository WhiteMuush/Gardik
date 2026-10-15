"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { RoleForm } from "./RoleForm"
import { PAGE_SIZE, RolesTable, type Role } from "./RolesTable"
import { StepUpDialog } from "./StepUpDialog"

async function fetchRoles(): Promise<Role[] | null> {
  const res = await fetch("/api/roles")
  return res.ok ? (await res.json()).roles : null
}

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([])
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Role | null>(null)
  // Explicit, since a new role's empty fields cannot tell "closed" from "creating".
  const [formOpen, setFormOpen] = useState(false)
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [stepUpRetry, setStepUpRetry] = useState<null | (() => void)>(null)

  async function load() {
    const next = await fetchRoles()
    if (next) setRoles(next)
  }
  useEffect(() => {
    void fetchRoles().then((next) => {
      if (next) setRoles(next)
    })
  }, [])

  const filtered = useMemo(
    () => roles.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [roles, query]
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

  // On STEP_UP_REQUIRED, stashes the call and replays it once the password is re-verified.
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
        })
      )
    } else {
      await mutate(() =>
        fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
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

      <RolesTable
        filtered={filtered}
        pageRoles={pageRoles}
        page={page}
        pages={pages}
        setPage={setPage}
        onEdit={startEdit}
        onDelete={(role) => void remove(role)}
      />

      {formOpen && (
        <RoleForm
          editingName={editing ? editing.name : null}
          name={name}
          setName={setName}
          perms={perms}
          setPerms={setPerms}
          error={error}
          onCancel={closeForm}
          onSave={() => void save()}
        />
      )}

      <StepUpDialog
        open={stepUpRetry !== null}
        onVerified={() => stepUpRetry?.()}
        onCancel={() => setStepUpRetry(null)}
      />
    </div>
  )
}
