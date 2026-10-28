"use client"

import { useState } from "react"
import type { Connection } from "./meta"

export function useConnections(initial: Connection[]) {
  const [connections, setConnections] = useState<Connection[]>(initial)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function sync(id: string) {
    setSyncingId(id)
    try {
      const res = await fetch(`/api/directory/${id}/sync`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setConnections((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: "ACTIVE",
                lastSyncAt: new Date().toISOString(),
                lastSyncCount: data.synced,
                errorMessage: null,
              }
            : c
        )
      )
    } catch (e: unknown) {
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "ERROR", errorMessage: (e as Error).message } : c))
      )
    } finally {
      setSyncingId(null)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/directory/${id}`, { method: "DELETE" })
      setConnections((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  // The wizard only returns id, type, name and status, so the sync fields start empty.
  function add(conn: Pick<Connection, "id" | "type" | "name" | "status">) {
    setConnections((prev) => [
      ...prev,
      {
        lastSyncAt: null,
        lastSyncCount: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        ...conn,
      },
    ])
  }

  return { connections, syncingId, deletingId, sync, remove, add }
}
