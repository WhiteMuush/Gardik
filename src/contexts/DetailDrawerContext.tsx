"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type DetailVariant = "critical" | "high" | "medium" | "low" | "ok" | "default"

export type DetailField = { label: string; value: ReactNode }

export type DetailPayload = {
  title: string
  subtitle?: string
  variant?: DetailVariant
  tags?: string[]
  fields: DetailField[]
}

type DetailDrawerCtx = {
  open: (payload: DetailPayload) => void
  close: () => void
}

const Ctx = createContext<DetailDrawerCtx | null>(null)

export function useDetailDrawer(): DetailDrawerCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useDetailDrawer must be used within DetailDrawerProvider")
  return ctx
}

const dotColor: Record<DetailVariant, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  ok: "bg-severity-ok",
  default: "bg-muted-foreground",
}

export function DetailDrawerProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DetailPayload | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const open = useCallback((p: DetailPayload) => setPayload(p), [])
  const close = useCallback(() => setPayload(null), [])

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [payload, close])

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-hidden={!payload}
            className={cn(
              "fixed inset-0 z-[60]",
              payload ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            {/* Overlay */}
            <div
              onClick={close}
              className={cn(
                "absolute inset-0 bg-black/40 transition-opacity duration-200",
                payload ? "opacity-100" : "opacity-0"
              )}
            />
            {/* Panel */}
            <aside
              role="dialog"
              aria-modal="true"
              className={cn(
                "absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl transition-transform duration-200 ease-out",
                payload ? "translate-x-0" : "translate-x-full"
              )}
            >
              {payload && (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {payload.variant && (
                          <span className={cn("size-2 shrink-0 rounded-full", dotColor[payload.variant])} />
                        )}
                        <h2 className="truncate text-base font-semibold text-foreground">{payload.title}</h2>
                      </div>
                      {payload.subtitle && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{payload.subtitle}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {payload.tags && payload.tags.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-1.5">
                        {payload.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <dl className="divide-y divide-border">
                      {payload.fields.map((f, i) => (
                        <div key={i} className="flex items-start justify-between gap-4 py-2.5">
                          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {f.label}
                          </dt>
                          <dd className="text-right text-sm font-medium tabular-nums text-foreground">
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </>
              )}
            </aside>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  )
}
