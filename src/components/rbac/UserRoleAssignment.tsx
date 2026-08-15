"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { StepUpDialog } from "./StepUpDialog"

type UserRow = { id: string; email: string; name: string; roleId: string | null; roleName: string | null }
// grantable comes from the server and already folds in the no-escalation rule,
// so the dropdown never offers a role the assignment call would refuse.
type RoleRow = { id: string; name: string; isAssignable: boolean; grantable: boolean }

export function UserRoleAssignment() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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

  // Both credential actions run behind step-up, same as assigning a
  // crown-jewel role: each one ends in somebody being able to sign in.
  async function credentialAction(
    userId: string,
    path: string,
    onOk: (body: { link?: string; delivered?: string }) => string
  ) {
    const res = await fetch(`/api/users/${userId}/${path}`, { method: "POST" })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      code?: string
      link?: string
      delivered?: string
    }
    if (res.status === 403 && body.code === "STEP_UP_REQUIRED") {
      setStepUpRetry(() => async () => {
        await credentialAction(userId, path, onOk)
      })
      return
    }
    if (!res.ok) {
      setError(body.error ?? "Failed")
      return
    }
    setError(null)
    setStepUpRetry(null)
    setNotice(onOk(body))
  }

  async function invite(userId: string) {
    await credentialAction(userId, "invite", (body) =>
      body.delivered === "email"
        ? "Invitation sent. The link works once and expires in 72 hours."
        : `Email is not configured here, so copy this one-time link: ${body.link}`
    )
  }

  async function requirePasswordChange(userId: string) {
    await credentialAction(
      userId,
      "require-password-change",
      () => "Done. Their sessions are closed and they must set a new password at next sign-in."
    )
  }

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
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p className="break-all text-xs text-muted-foreground">{notice}</p>}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Person
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Credentials
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                  No one matches this search
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{u.name || u.email}</span>
                    {u.name && <span className="ml-2 text-muted-foreground">{u.email}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.roleId ?? ""}
                      onChange={(e) => assign(u.id, e.target.value || null)}
                      className="rounded-lg border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none"
                    >
                      <option value="">No access</option>
                      {roles
                        .filter((r) => r.grantable)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void invite(u.id)}
                        className="rounded-lg border border-input px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60"
                      >
                        Send invitation
                      </button>
                      <button
                        type="button"
                        onClick={() => void requirePasswordChange(u.id)}
                        className="rounded-lg border border-input px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60"
                      >
                        Force new password
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "person" : "people"}
          </p>
        </div>
      </div>

      <StepUpDialog
        open={stepUpRetry !== null}
        onVerified={() => stepUpRetry?.()}
        onCancel={() => setStepUpRetry(null)}
      />
    </div>
  )
}
