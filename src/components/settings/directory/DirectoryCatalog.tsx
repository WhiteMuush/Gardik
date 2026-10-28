"use client"

import { useMemo, useState } from "react"
import { CatalogToolbar } from "@/components/credentials/CatalogToolbar"
import type { DirectoryType } from "../connect-wizard/providers"
import { ConnectWizard } from "../ConnectWizard"
import { DirectoryDrawer } from "./DirectoryDrawer"
import { DirectoryTile } from "./DirectoryTile"
import {
  buildDirectoryViews,
  DIRECTORY_FILTERS,
  matchesDirectory,
  type DirectoryFilter,
} from "./directory-view"
import type { Connection } from "./meta"
import { useConnections } from "./use-connections"

type Props = {
  initial: Connection[]
  isAdmin: boolean
}

export function DirectoryCatalog({ initial, isAdmin }: Props) {
  const { connections, syncingId, deletingId, sync, remove, add } = useConnections(initial)
  const [filter, setFilter] = useState<DirectoryFilter>("All")
  const [query, setQuery] = useState("")
  const [openType, setOpenType] = useState<DirectoryType | null>(null)
  const [wizardType, setWizardType] = useState<DirectoryType | null>(null)

  const views = useMemo(() => buildDirectoryViews(connections), [connections])
  const visible = views.filter((v) => matchesDirectory(v, filter, query))
  const open = views.find((v) => v.provider.type === openType) ?? null

  return (
    <div>
      <CatalogToolbar
        noun="directories"
        query={query}
        onQuery={setQuery}
        filters={DIRECTORY_FILTERS}
        filter={filter}
        onFilter={setFilter}
      />

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No directory matches these filters.</p>
          <button
            type="button"
            onClick={() => {
              setFilter("All")
              setQuery("")
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Show all directories
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((view) => (
            <DirectoryTile
              key={view.provider.type}
              view={view}
              onOpen={() => setOpenType(view.provider.type)}
            />
          ))}
        </div>
      )}

      <DirectoryDrawer
        view={open}
        isAdmin={isAdmin}
        syncingId={syncingId}
        deletingId={deletingId}
        onSync={(id) => void sync(id)}
        onDelete={(id) => void remove(id)}
        onConnect={() => open && setWizardType(open.provider.type)}
        onClose={() => setOpenType(null)}
      />

      {wizardType && (
        <ConnectWizard
          type={wizardType}
          onClose={() => setWizardType(null)}
          onCreated={(conn) => add(conn as Parameters<typeof add>[0])}
        />
      )}
    </div>
  )
}
