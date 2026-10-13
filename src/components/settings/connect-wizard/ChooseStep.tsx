"use client"

import { ChevronRight } from "lucide-react"
import { PROVIDERS, type DirectoryType } from "./providers"

export function ChooseStep({ onChoose }: { onChoose: (type: DirectoryType) => void }) {
  return (
    <div className="space-y-2">
      <p className="mb-4 text-sm text-muted-foreground">Choose the type of directory to connect.</p>
      {PROVIDERS.map((p) => (
        <button
          key={p.type}
          onClick={() => onChoose(p.type)}
          className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            {p.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}
