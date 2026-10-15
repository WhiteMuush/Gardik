"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { StepUpDialog } from "./StepUpDialog"
import { PeopleTable, type RoleRow, type UserRow } from "./PeopleTable"

async function fetchDirectory(): Promise<{ users: UserRow[] | null; roles: RoleRow[] | null }> {
  const [u, r] = await Promise.all([fetch("/api/users"), fetch("/api/roles")])
  return {
    users: u.ok ? (await u.json()).users : null,
    roles: r.ok ? (await r.json()).roles : null,
  }
}

export function UserRoleAssignment() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [stepUpRetry, setStepUpRetry] = useState<null | (() => void)>(null)

  const apply = (next: Awaited<ReturnType<typeof fetchDirectory>>) => {
    if (next.users) setUsers(next.users)
    if (next.roles) setRoles(next.roles)
  }
  async function load() {
    apply(await fetchDirectory())
  }
  useEffect(() => {
    void fetchDirectory().then(apply)
  }, [])

  const filtered = useMemo(
    () => users.filter((u) => u.email.toLowerCase().includes(query.toLowerCase())),
    [users, query]
  )

  // Both credential actions need step-up, since each ends with somebody able to sign in.
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

      <PeopleTable
        filtered={filtered}
        roles={roles}
        onAssign={(userId, roleId) => void assign(userId, roleId)}
        onInvite={(userId) => void invite(userId)}
        onRequirePasswordChange={(userId) => void requirePasswordChange(userId)}
      />

      <StepUpDialog
        open={stepUpRetry !== null}
        onVerified={() => stepUpRetry?.()}
        onCancel={() => setStepUpRetry(null)}
      />
    </div>
  )
}
