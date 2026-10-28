"use client"

import { useState } from "react"
import { AlertTriangle, Copy, Check } from "lucide-react"

export function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="group inline-flex max-w-full items-center gap-1">
      <code className="min-w-0 break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {children}
      </code>
      <button
        onClick={copy}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
    </span>
  )
}

export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-xs text-foreground">{children}</p>
    </div>
  )
}

export function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground mt-0.5">
        {n}
      </span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children && <div className="space-y-1.5">{children}</div>}
      </div>
    </div>
  )
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
}
