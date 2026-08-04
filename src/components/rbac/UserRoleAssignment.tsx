"use client"

import { useEffect, useMemo, useState } from "react"
import { StepUpDialog } from "./StepUpDialog"

type UserRow = { id: string; email: string; name: string; roleId: string | null; roleName: string | null }
type RoleRow = { id: string; name: string; isAssignable: boolean }

export function UserRoleAssignment() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [stepUpRetry, setStepUpRetry] = useState<null | (() => void)>(null)

  async function load() {
    const [u, r] = await Promise.all([fetch("/api/users"), fetch("/api/roles")])
    if (u.ok) setUsers((await u.json()).users)
    if (r.ok) setRoles((await r.json()).roles)
  }
  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(
    () => users.filter((u) => u.email.toLowerCase().includes(query.toLowerCase())),
    [users, query],
  )

  async function assign(userId: string, roleId: string | null) {
    const run = () =>
      fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      })
    const res = await run()
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      if (body.code === "STEP_UP_REQUIRED") {
        setStepUpRetry(() => async () => {
          await assign(userId, roleId)
        })
        return
      }
      setError(body.error ?? "Forbidden")
      return
    }
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed")
      return
    }
    setError(null)
    setStepUpRetry(null)
    await load()
  }

  return (
    <div className="space-y-3">
      <input
        placeholder="Search users"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
        {filtered.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-foreground">{u.email}</span>
            <select
              value={u.roleId ?? ""}
              onChange={(e) => assign(u.id, e.target.value || null)}
              className="rounded-lg border border-input bg-card px-2 py-1 text-xs"
            >
              <option value="">No access</option>
              {roles
                .filter((r) => r.isAssignable)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </li>
        ))}
      </ul>
      <StepUpDialog
        open={stepUpRetry !== null}
        onVerified={() => stepUpRetry?.()}
        onCancel={() => setStepUpRetry(null)}
      />
    </div>
  )
}
