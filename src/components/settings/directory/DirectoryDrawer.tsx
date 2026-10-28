"use client"

import { ExternalLink, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CatalogDrawer } from "@/components/credentials/CatalogDrawer"
import { Section } from "@/components/credentials/DrawerSection"
import { SourceAvatar } from "@/components/credentials/SourceBadges"
import { ConnectionCard } from "./ConnectionCard"
import { DirectoryStatusPill } from "./DirectoryTile"
import { GUIDES } from "./guides"
import type { DirectoryView } from "./directory-view"

type Props = {
  view: DirectoryView | null
  isAdmin: boolean
  syncingId: string | null
  deletingId: string | null
  onSync: (id: string) => void
  onDelete: (id: string) => void
  onConnect: () => void
  onClose: () => void
}

export function DirectoryDrawer({ view, onClose, ...rest }: Props) {
  return (
    <CatalogDrawer
      open={view !== null}
      label={view ? `${view.provider.label} details` : undefined}
      onClose={onClose}
    >
      {view && <DirectoryDetails view={view} onClose={onClose} {...rest} />}
    </CatalogDrawer>
  )
}

function DirectoryDetails({
  view,
  isAdmin,
  syncingId,
  deletingId,
  onSync,
  onDelete,
  onConnect,
  onClose,
}: Props & { view: DirectoryView }) {
  const Guide = GUIDES[view.provider.type]

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border p-5">
        <SourceAvatar initials={view.initials} logo={view.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{view.provider.label}</p>
          <div className="mt-1.5">
            <DirectoryStatusPill status={view.status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="Overview">
          <p className="text-sm text-foreground">{view.provider.description}</p>
          {view.provider.docsUrl && (
            <a
              href={view.provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Provider documentation <ExternalLink className="size-3" />
            </a>
          )}
        </Section>

        <Section title="Connections">
          {view.connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {view.provider.label} directory connected yet.</p>
          ) : (
            <div className="space-y-3">
              {view.connections.map((conn) => (
                <ConnectionCard
                  key={conn.id}
                  conn={conn}
                  isAdmin={isAdmin}
                  isSyncing={syncingId === conn.id}
                  isDeleting={deletingId === conn.id}
                  onSync={onSync}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
          {isAdmin && (
            <Button size="sm" className="mt-4" onClick={onConnect}>
              <Plus className="mr-1.5 size-3.5" />
              Connect {view.provider.label}
            </Button>
          )}
        </Section>

        <Section title="Setup guide">
          <Guide />
        </Section>
      </div>
    </>
  )
}
