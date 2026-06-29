"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type DetailVariant = "critical" | "high" | "medium" | "low" | "ok" | "default"

export type DetailField = { label: string; value: ReactNode }

export type DetailGroup = { heading?: string; fields: DetailField[] }

export type DetailPayload = {
  title: string
  subtitle?: string
  variant?: DetailVariant
  tags?: string[]
  // Either flat fields (static callers) or grouped sections (rich fetches).
  fields?: DetailField[]
  groups?: DetailGroup[]
}

// Reference to an entity the drawer can fetch rich detail for on click.
export type DetailRef = {
  kind: "employee" | "breach" | "alert"
  id: string
  title: string
  subtitle?: string
  variant?: DetailVariant
}

type DetailDrawerCtx = {
  open: (payload: DetailPayload) => void
  openRef: (ref: DetailRef) => void
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
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const open = useCallback((p: DetailPayload) => {
    setLoading(false)
    setPayload(p)
  }, [])

  const close = useCallback(() => {
    setPayload(null)
    setLoading(false)
  }, [])

  const openRef = useCallback((ref: DetailRef) => {
    // Show what we already know immediately, then enrich from the API.
    setPayload({ title: ref.title, subtitle: ref.subtitle, variant: ref.variant, groups: [] })
    setLoading(true)
    fetch(`/api/dashboard/detail/${ref.kind}/${ref.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: DetailPayload) => setPayload(data))
      .catch(() =>
        setPayload({
          title: ref.title,
          subtitle: ref.subtitle,
          variant: ref.variant,
          fields: [{ label: "Error", value: "Could not load details" }],
        })
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [payload, close])

  return (
    <Ctx.Provider value={{ open, openRef, close }}>
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
            <div
              onClick={close}
              className={cn(
                "absolute inset-0 bg-black/40 transition-opacity duration-200",
                payload ? "opacity-100" : "opacity-0"
              )}
            />
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
                        <h2 className="truncate text-sm font-semibold text-foreground">{payload.title}</h2>
                        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
                      </div>
                      {payload.subtitle && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{payload.subtitle}</p>
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

                    {payload.fields && <FieldList fields={payload.fields} />}

                    {payload.groups?.map((g, gi) => (
                      <div key={gi} className={cn(gi > 0 && "mt-5")}>
                        {g.heading && (
                          <p className="mb-1 text-xs font-semibold text-foreground">{g.heading}</p>
                        )}
                        <FieldList fields={g.fields} />
                      </div>
                    ))}

                    {loading && (!payload.groups || payload.groups.length === 0) && !payload.fields && (
                      <p className="py-6 text-center text-sm text-muted-foreground">Loading details...</p>
                    )}
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

function FieldList({ fields }: { fields: DetailField[] }) {
  return (
    <dl className="divide-y divide-border">
      {fields.map((f, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {f.label}
          </dt>
          <dd className="text-right text-xs font-medium text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
