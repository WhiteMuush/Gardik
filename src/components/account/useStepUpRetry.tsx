"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { StepUpDialog } from "@/components/rbac/StepUpDialog"

type Call = () => Promise<Response>

// Replays a request once identity is re-proven, so an expired step-up never discards what the user typed.
export function useStepUpRetry(): { run: (call: Call) => Promise<Response | null>; dialog: ReactNode } {
  const router = useRouter()
  const settle = useRef<((verified: boolean) => void) | null>(null)
  const [open, setOpen] = useState(false)

  const run = useCallback(
    async (call: Call) => {
      const res = await call()
      if (res.status !== 403) return res
      const body = (await res
        .clone()
        .json()
        .catch(() => ({}))) as { code?: string }
      if (body.code !== "STEP_UP_REQUIRED") return res

      setOpen(true)
      const verified = await new Promise<boolean>((resolve) => {
        settle.current = resolve
      })
      setOpen(false)
      // A refresh brings the full gate back, which also offers the authenticator code the dialog lacks.
      if (!verified) {
        router.refresh()
        return null
      }
      return call()
    },
    [router]
  )

  const dialog = (
    <StepUpDialog
      open={open}
      onVerified={() => settle.current?.(true)}
      onCancel={() => settle.current?.(false)}
    />
  )
  return { run, dialog }
}
