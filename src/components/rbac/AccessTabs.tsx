"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tab = { id: string; label: string; panel: ReactNode }

// Three lists stacked on one page ran past 2000px. Tabs keep each one inside a
// single viewport without inventing a new visual language: the strip is a plain
// underlined row, no pills, no colour.
export function AccessTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex items-center gap-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current?.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "-mb-px border-b-2 px-0.5 pb-2.5 text-sm transition-colors",
              t.id === current?.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.panel}</div>
    </div>
  )
}
