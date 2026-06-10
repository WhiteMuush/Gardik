"use client"

import { Printer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function ReportToolbar({ generatedAt }: { generatedAt: string }) {
  return (
    <div className="no-print flex items-center gap-2">
      <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">
        Generated {formatTimestamp(generatedAt)}
      </span>
      <a href="/api/reports/export?section=all" download>
        <Button variant="outline" size="sm">
          <Download className="size-3.5" />
          CSV
        </Button>
      </a>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-3.5" />
        PDF
      </Button>
    </div>
  )
}
