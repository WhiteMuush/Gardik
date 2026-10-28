"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type Status = { on: boolean; label: string }

type Props = {
  title: string
  description: string
  status: Status
  action?: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function SettingRow({ title, description, status, action, open, onToggle, children }: Props) {
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              status.on
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", status.on ? "bg-green-500" : "bg-muted-foreground/50")}
            />
            {status.label}
          </span>
          {action}
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${title} details`}
            onClick={onToggle}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      {open && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  )
}
