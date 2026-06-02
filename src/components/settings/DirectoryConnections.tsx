"use client"

import { useState } from "react"
import {
  Plus,
  RefreshCw,
  Trash2,
  Building2,
  Globe,
  Network,
  Cloud,
  Shield,
  Link,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectWizard } from "./ConnectWizard"
import { cn } from "@/lib/utils"

type ConnectStatus = "ACTIVE" | "ERROR" | "PENDING"
type DirectoryType = "AZURE_AD" | "GOOGLE_WORKSPACE" | "LDAP" | "AWS_DIRECTORY" | "OKTA" | "SCIM"

type Connection = {
  id: string
  type: DirectoryType
  name: string
  status: ConnectStatus
  lastSyncAt: string | null
  lastSyncCount: number | null
  errorMessage: string | null
  createdAt: string
}

const TYPE_META: Record<DirectoryType, { label: string; icon: React.ReactNode; color: string }> = {
  AZURE_AD: {
    label: "Azure AD",
    icon: <Building2 className="size-4" />,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  GOOGLE_WORKSPACE: {
    label: "Google Workspace",
    icon: <Globe className="size-4" />,
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  LDAP: {
    label: "LDAP",
    icon: <Network className="size-4" />,
    color: "bg-muted text-muted-foreground",
  },
  AWS_DIRECTORY: {
    label: "AWS Identity Center",
    icon: <Cloud className="size-4" />,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  OKTA: {
    label: "Okta",
    icon: <Shield className="size-4" />,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  SCIM: {
    label: "SCIM 2.0",
    icon: <Link className="size-4" />,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
}

const STATUS_DOT: Record<ConnectStatus, string> = {
  ACTIVE: "bg-green-500",
  ERROR: "bg-destructive",
  PENDING: "bg-yellow-500",
}

const STATUS_LABEL: Record<ConnectStatus, string> = {
  ACTIVE: "Active",
  ERROR: "Error",
  PENDING: "Pending",
}

function formatDate(iso: string | null) {
  if (!iso) return "Never"
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

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
        prev.map((c) =>
          c.id === id ? { ...c, status: "ERROR", errorMessage: (e as Error).message } : c
        )
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <Network className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No directory connected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect Azure AD, Google Workspace, or an LDAP server to import your employees
              automatically.
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
            {connections.map((conn) => {
              const meta = TYPE_META[conn.type]
              const isSyncing = syncingId === conn.id
              const isDeleting = deletingId === conn.id

              return (
                <div
                  key={conn.id}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card px-4 py-4"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      meta.color
                    )}
                  >
                    {meta.icon}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{conn.name}</p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          meta.color
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", STATUS_DOT[conn.status])} />
                      <span className="text-xs text-muted-foreground">
                        {STATUS_LABEL[conn.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        Last sync: {formatDate(conn.lastSyncAt)}
                      </span>
                      {conn.lastSyncCount !== null && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {conn.lastSyncCount} employee{conn.lastSyncCount !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>

                    {conn.status === "ERROR" && conn.errorMessage && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5">
                        <AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
                        <p className="text-xs text-destructive">{conn.errorMessage}</p>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(conn.id)}
                        disabled={isSyncing || isDeleting}
                      >
                        {isSyncing ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        <span className="ml-1.5">{isSyncing ? "Syncing..." : "Sync now"}</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(conn.id)}
                        disabled={isDeleting || isSyncing}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
