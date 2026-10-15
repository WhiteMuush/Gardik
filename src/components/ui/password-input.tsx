"use client"

import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

// Refuses copy, cut and drag but not paste, which password managers need; devtools still read the value.
export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      type="password"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className={cn("w-full rounded-lg border border-input bg-background px-3 py-2 text-sm", className)}
    />
  )
}
