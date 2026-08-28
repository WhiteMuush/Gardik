"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScanSearch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type ScanResult = {
  scanned: number
  newRecords: number
  newAlerts: number
}

export function ScanButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function scan() {
    setLoading(true)
    setResult(null)
    setError(null)

    const res = await fetch("/api/employees/scan", { method: "POST" })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Scan failed")
    } else {
      setResult(data)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <p className="text-xs text-muted-foreground">
          {result.scanned} scanned - {result.newRecords} new exposure{result.newRecords !== 1 ? "s" : ""} - {result.newAlerts} alert{result.newAlerts !== 1 ? "s" : ""} created
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button variant="outline" size="sm" onClick={scan} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
        {loading ? "Scanning..." : "Scan employees"}
      </Button>
    </div>
  )
}
