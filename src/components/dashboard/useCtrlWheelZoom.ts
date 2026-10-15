"use client"

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react"

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_SENS = 0.0015

// Ctrl or Cmd + wheel zooms the grid view; a trackpad pinch also sets ctrlKey, so the physical key is tracked.
export function useCtrlWheelZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  editing: boolean,
  setZoomLevel: Dispatch<SetStateAction<number>>
) {
  const ctrlHeld = useRef(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") ctrlHeld.current = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") ctrlHeld.current = false
    }
    const reset = () => {
      ctrlHeld.current = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", reset)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", reset)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || editing) return
    const handler = (e: WheelEvent) => {
      if (!ctrlHeld.current) return
      e.preventDefault()
      setZoomLevel((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * Math.exp(-e.deltaY * ZOOM_SENS))))
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [containerRef, editing, setZoomLevel])
}
