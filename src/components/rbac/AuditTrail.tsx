"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"

type Snapshot = { name?: string; permissions?: string[]; roleId?: string | null }

type Entry = {
  id: string
  action: string
  targetType: string
  targetId: string | null
  before: Snapshot | null
  after: Snapshot | null
  ip: string | null
  createdAt: string
  actor: { email: string } | null
}

const PAGE = 20

// Names are resolved from the roles and users endpoints when the viewer is
// allowed to read them. audit:read does not imply roles:read or users:read, so
// a denied lookup degrades to the raw id rather than blanking the column.
function useNames() {
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    void (async () => {
      const map: Record<string, string> = {}
      const [r, u] = await Promise.all([
        fetch("/api/roles").catch(() => null),
        fetch("/api/users").catch(() => null),
      ])
      if (r?.ok) for (const role of (await r.json()).roles as { id: string; name: string }[]) map[role.id] = role.name
      if (u?.ok) for (const user of (await u.json()).users as { id: string; email: string }[]) map[user.id] = user.email
      setNames(map)
    })()
  }, [])
  return names
}

function describeTarget(e: Entry, names: Record<string, string>): string {
  const named = e.after?.name ?? e.before?.name ?? (e.targetId ? names[e.targetId] : undefined)
  if (named) return named
  return e.targetId ? e.targetId.slice(0, 8) : "-"
}

// What actually changed, in the terms the reader cares about: which permissions
// moved, or which role a person went to. Raw JSON would be unreadable here, and
// so is a plain "a -> b" string: only the destination matters, so the previous
// value steps back rather than sharing the weight.
function Change({ entry, names }: { entry: Entry; names: Record<string, string> }) {
  if (entry.action === "user.role.assign") {
    const from = entry.before?.roleId ? (names[entry.before.roleId] ?? "a role") : "No access"
    const to = entry.after?.roleId ? (names[entry.after.roleId] ?? "a role") : "No access"
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground/70">{from}</span>
        <ArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground/50" />
        <span className="text-foreground">{to}</span>
      </span>
    )
  }

  const before = entry.before?.permissions
  const after = entry.after?.permissions
  if (before && after) {
    const added = after.filter((p) => !before.includes(p))
    const removed = before.filter((p) => !after.includes(p))
    if (added.length === 0 && removed.length === 0) {
      return <span className="text-muted-foreground/70">No permission change</span>
    }
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {added.map((p) => (
          <span key={`+${p}`} className="text-foreground">
            + {p}
          </span>
        ))}
        {removed.map((p) => (
          <span key={`-${p}`} className="text-muted-foreground/70 line-through">
            {p}
          </span>
        ))}
      </span>
    )
  }

  // Create and delete carry a single snapshot, so there is nothing to diff.
  const list = after ?? before
  if (list) {
    return (
      <span className="text-muted-foreground">
        {list.length} permission{list.length === 1 ? "" : "s"}
      </span>
    )
  }
  return <span className="text-muted-foreground/70">&mdash;</span>
}

export function AuditTrail() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const names = useNames()

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/audit?take=${PAGE}&skip=${skip}`)
      if (res.ok) {
        const data = (await res.json()) as { entries: Entry[]; total: number }
        setEntries(data.entries)
        setTotal(data.total)
      }
    })()
  }, [skip])

  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {["When", "Who", "Action", "Target", "Change"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Nothing recorded yet
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {e.actor?.email ?? "system"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{e.action}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {describeTarget(e, names)}
                  </td>
                  <td className="px-4 py-3">
                    <Change entry={e} names={names} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {total} event{total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={skip === 0}
            onClick={() => setSkip((s) => Math.max(0, s - PAGE))}
            aria-label="Previous page"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.floor(skip / PAGE) + 1} / {pages}
          </span>
          <button
            disabled={skip + PAGE >= total}
            onClick={() => setSkip((s) => s + PAGE)}
            aria-label="Next page"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
