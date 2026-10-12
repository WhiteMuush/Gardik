"use client"

import { useSyncExternalStore } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const KEY = "gardik-scan-banner-dismissed"

// A dismiss in this tab does not fire the storage event, so readers are
// notified by hand; the event still covers other tabs.
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

// Hidden while the dismissed status is still the current one; a different
// signature (a new scan result) shows the banner again.
type Props = { signature: string; className?: string; children: React.ReactNode }

export function DismissibleBanner({ signature, className, children }: Props) {
  const dismissed = useSyncExternalStore(subscribe, read, () => null)
  if (dismissed === signature) return null

  function dismiss() {
    try {
      localStorage.setItem(KEY, signature)
    } catch {
      return
    }
    listeners.forEach((notify) => notify())
  }

  return (
    <div className={cn("relative", className)}>
      {children}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss until the scan status changes"
        title="Dismiss until the scan status changes"
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
