"use client"

import { useState } from "react"
import QRCode from "qrcode"
import { twoFactor } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

export function TwoFactorSetup({
  enabled,
  continueTo,
}: {
  enabled: boolean
  /** Set on the pre-dashboard gate: where to go once enrollment succeeds. */
  continueTo?: string
}) {
  const [password, setPassword] = useState("")
  const [qr, setQr] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(enabled)

  async function enable() {
    setError(null)
    const { data, error } = await twoFactor.enable({ password })
    if (error || !data) {
      setError("Wrong password")
      return
    }
    setQr(await QRCode.toDataURL(data.totpURI))
    setBackupCodes(data.backupCodes)
  }

  async function verify() {
    setError(null)
    const { error } = await twoFactor.verifyTotp({ code })
    if (error) {
      setError("Invalid code")
      return
    }
    setDone(true)
    // Full navigation rather than a router push: the session carries
    // twoFactorEnabled, and the gate that sent the user here reads it.
    if (continueTo) window.location.assign(continueTo)
  }

  if (done) return <p className="text-sm text-muted-foreground">Two-factor is enabled.</p>

  return (
    <div className="space-y-4">
      {!qr ? (
        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your password"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <Button onClick={enable}>Enable two-factor</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR is a local data URI, next/image adds nothing */}
          <img src={qr} alt="Scan with your authenticator app" className="h-40 w-40" />
          <div className="text-xs">
            <p className="font-medium">Backup codes (save these once):</p>
            <ul className="grid grid-cols-2 gap-1 font-mono">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <Button onClick={verify}>Verify and finish</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
