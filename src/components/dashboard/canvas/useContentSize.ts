"use client"

import { useEffect, useState, type RefObject } from "react"

// contentRect is the pre-transform box, so a scaled element still reports its natural size.
export function useContentSize(ref: RefObject<HTMLElement | null>, axis: "width" | "height"): number {
  const [size, setSize] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => entry && setSize(entry.contentRect[axis]))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, axis])
  return size
}
