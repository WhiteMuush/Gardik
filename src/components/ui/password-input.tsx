"use client"

import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

// A password field whose value cannot be lifted out of it. Masking hides the
// characters from someone looking at the screen; it does nothing about
// selecting the field and copying, which is the actual way a password leaves a
// borrowed machine and lands in a chat window or a clipboard manager.
//
// Copy, cut and drag are refused. Paste is not: password managers fill fields
// that way, and blocking it pushes people towards passwords they can type from
// memory, which is the opposite of the goal.
//
// Worth being plain about the limit: this stops the casual path, not an
// attacker at the keyboard, who can read the value from the devtools whatever
// this component does.
export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      type="password"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
        className
      )}
    />
  )
}
