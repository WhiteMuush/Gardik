"use client"

import { useEffect, useState } from "react"

type Entry = {
  id: string
  action: string
  targetType: string
  targetId: string | null
  createdAt: string
  actor: { email: string } | null
}

const PAGE = 20

export function AuditTrail() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)

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

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-xs">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-foreground">{e.action}</span>
            <span className="text-muted-foreground">
              {e.actor?.email ?? "system"} - {new Date(e.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} event(s)</span>
        <div className="flex gap-2">
          <button disabled={skip === 0} onClick={() => setSkip((s) => Math.max(0, s - PAGE))} className="disabled:opacity-40">
            Prev
          </button>
          <button disabled={skip + PAGE >= total} onClick={() => setSkip((s) => s + PAGE)} className="disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
