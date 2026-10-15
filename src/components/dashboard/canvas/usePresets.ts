"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { DashboardPreset, GridItemLayout, WidgetMeta } from "@/types/dashboard"
import { saveRequest } from "@/lib/save-request"
import { useSaveGuard } from "../SaveErrorBar"
import { buildDefaultLayout, buildDefaultMeta, mergeLayout, mergeMeta } from "../dashboardLayoutUtils"
import type { WidgetEntry } from "./types"

// Owns the presets, the active layout and widget meta, and every save to the server.
export function usePresets(
  widgets: WidgetEntry[],
  initialPresets: DashboardPreset[],
  initialActivePresetId: string | null
) {
  const router = useRouter()
  const [presets, setPresets] = useState<DashboardPreset[]>(initialPresets)
  const [activePresetId, setActivePresetId] = useState<string | null>(initialActivePresetId)
  const activePreset = presets.find((p) => p.id === activePresetId) ?? presets[0] ?? null

  const initLayout = useCallback(
    (preset: DashboardPreset | null) => {
      if (!preset || !preset.layout?.length) return buildDefaultLayout(widgets)
      return mergeLayout(preset.layout, widgets)
    },
    [widgets]
  )

  const initMeta = useCallback(
    (preset: DashboardPreset | null) => {
      if (!preset || !preset.widgets?.length) return buildDefaultMeta(widgets)
      return mergeMeta(preset.widgets, widgets)
    },
    [widgets]
  )

  const [layout, setLayout] = useState<GridItemLayout[]>(() => initLayout(activePreset))
  const [meta, setMeta] = useState<WidgetMeta[]>(() => initMeta(activePreset))
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { failure, guard, dismiss } = useSaveGuard()

  const persistPreset = useCallback(
    (id: string, nextLayout: GridItemLayout[], nextMeta: WidgetMeta[]) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, layout: nextLayout, widgets: nextMeta } : p))
      )
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      const body = { layout: nextLayout, widgets: nextMeta }
      saveTimeout.current = setTimeout(() => {
        guard(async () => !!(await saveRequest(`/api/dashboard/presets/${id}`, "PUT", body)))
      }, 800)
    },
    [guard]
  )

  const switchPreset = useCallback(
    (preset: DashboardPreset) => {
      setActivePresetId(preset.id)
      setLayout(initLayout(preset))
      setMeta(initMeta(preset))
      guard(async () => !!(await saveRequest(`/api/dashboard/presets/${preset.id}/activate`, "PATCH")))
    },
    [initLayout, initMeta, guard]
  )

  const createPreset = useCallback(
    async (scope: "PERSONAL" | "COMPANY") => {
      const name =
        scope === "COMPANY"
          ? "Company View"
          : `View ${presets.filter((p) => p.scope === "PERSONAL").length + 1}`
      const body = { name, scope, layout: buildDefaultLayout(widgets), widgets: buildDefaultMeta(widgets) }
      guard(async () => {
        const res = await saveRequest("/api/dashboard/presets", "POST", body)
        if (!res) return false
        const created: DashboardPreset = await res.json()
        setPresets((prev) => [...prev, created])
        switchPreset(created)
        return true
      })
    },
    [presets, widgets, switchPreset, guard]
  )

  const renamePreset = useCallback(
    (id: string, name: string) =>
      guard(async () => {
        if (!(await saveRequest(`/api/dashboard/presets/${id}`, "PUT", { name }))) return false
        setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
        return true
      }),
    [guard]
  )

  const deletePreset = useCallback(
    (id: string) =>
      guard(async () => {
        if (!(await saveRequest(`/api/dashboard/presets/${id}`, "DELETE"))) return false
        setPresets((prev) => {
          const next = prev.filter((p) => p.id !== id)
          if (activePresetId === id) {
            const fallback = next[0] ?? null
            setActivePresetId(fallback?.id ?? null)
            setLayout(initLayout(fallback))
            setMeta(initMeta(fallback))
          }
          return next
        })
        return true
      }),
    [activePresetId, initLayout, initMeta, guard]
  )

  const setTitle = useCallback(
    (instanceId: string, title: string) => {
      const next = meta.map((m) => (m.instanceId === instanceId ? { ...m, title } : m))
      setMeta(next)
      if (activePreset) persistPreset(activePreset.id, layout, next)
    },
    [meta, layout, activePreset, persistPreset]
  )

  const getTitle = useCallback(
    (instanceId: string, defaultTitle: string) =>
      meta.find((m) => m.instanceId === instanceId)?.title ?? defaultTitle,
    [meta]
  )

  const getSource = useCallback(
    (instanceId: string) => meta.find((m) => m.instanceId === instanceId)?.source ?? null,
    [meta]
  )

  // A full save then a refresh, because the server computes the slices that sources and resets change.
  const saveAndRefresh = useCallback(
    (id: string, nextLayout: GridItemLayout[], nextMeta: WidgetMeta[]) => {
      guard(async () => {
        const saved = await saveRequest(`/api/dashboard/presets/${id}`, "PUT", {
          layout: nextLayout,
          widgets: nextMeta,
        })
        if (saved) router.refresh()
        return !!saved
      })
    },
    [guard, router]
  )

  const setSource = useCallback(
    (instanceId: string, source: string | null) => {
      const next = meta.map((m) => (m.instanceId === instanceId ? { ...m, source } : m))
      setMeta(next)
      if (!activePreset) return
      setPresets((prev) => prev.map((p) => (p.id === activePreset.id ? { ...p, widgets: next } : p)))
      saveAndRefresh(activePreset.id, layout, next)
    },
    [meta, layout, activePreset, saveAndRefresh]
  )

  const reset = useCallback(() => {
    if (!activePreset) return
    const l = buildDefaultLayout(widgets)
    const m = buildDefaultMeta(widgets)
    setLayout(l)
    setMeta(m)
    setPresets((prev) => prev.map((p) => (p.id === activePreset.id ? { ...p, layout: l, widgets: m } : p)))
    saveAndRefresh(activePreset.id, l, m)
  }, [activePreset, widgets, saveAndRefresh])

  return {
    presets,
    activePreset,
    layout,
    setLayout,
    meta,
    persistPreset,
    switchPreset,
    createPreset,
    renamePreset,
    deletePreset,
    setTitle,
    getTitle,
    getSource,
    setSource,
    reset,
    failure,
    dismiss,
  }
}
