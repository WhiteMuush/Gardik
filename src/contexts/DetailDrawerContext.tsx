"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { DetailDrawerBody } from "@/components/layout/DetailDrawerBody"

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

const subscribeNever = () => () => {}

export function DetailDrawerProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  // false on the server and during hydration, true once on the client: the
  // portal target (document.body) only exists there.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  )

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
            className={cn("fixed inset-0 z-[60]", payload ? "pointer-events-auto" : "pointer-events-none")}
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
              {payload && <DetailDrawerBody payload={payload} loading={loading} onClose={close} />}
            </aside>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  )
}
