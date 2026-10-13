"use client"

import { useState } from "react"
import { Plus, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectWizard } from "./ConnectWizard"
import { ConnectionCard } from "./directory/ConnectionCard"
import type { Connection } from "./directory/meta"

type Props = {
  initial: Connection[]
  isAdmin: boolean
}

export function DirectoryConnections({ initial, isAdmin }: Props) {
  const [connections, setConnections] = useState<Connection[]>(initial)
  const [showWizard, setShowWizard] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleSync(id: string) {
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

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/directory/${id}`, { method: "DELETE" })
      setConnections((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {showWizard && (
        <ConnectWizard
          onClose={() => setShowWizard(false)}
          onCreated={(conn) => {
            setConnections((prev) => [...prev, conn as Connection])
          }}
        />
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Connected directories</h3>
            <p className="text-xs text-muted-foreground">
              Automatically sync your employees from your IAM infrastructure.
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowWizard(true)}>
              <Plus className="mr-1.5 size-3.5" />
              Connect directory
            </Button>
          )}
        </div>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-12 text-center">
            <Network className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No directory connected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect Azure AD, Google Workspace, or an LDAP server to import your employees automatically.
            </p>
            {isAdmin && (
              <Button size="sm" className="mt-4" onClick={() => setShowWizard(true)}>
                <Plus className="mr-1.5 size-3.5" />
                Connect directory
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                conn={conn}
                isAdmin={isAdmin}
                isSyncing={syncingId === conn.id}
                isDeleting={deletingId === conn.id}
                onSync={handleSync}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
