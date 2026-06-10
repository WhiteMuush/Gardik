"use client"

import { useState } from "react"
import { Printer, Download, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

const CSV_SECTIONS = [
  { key: "all", label: "Full report" },
  { key: "exposure", label: "Exposure" },
  { key: "datatypes", label: "Data types" },
  { key: "departments", label: "Departments" },
  { key: "employees", label: "Employees" },
  { key: "trends", label: "Trends" },
  { key: "compliance", label: "Compliance" },
]

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function ReportToolbar({ generatedAt }: { generatedAt: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="no-print flex items-center gap-2">
      <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">
        Generated {formatTimestamp(generatedAt)}
      </span>
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Download className="size-3.5" />
          CSV
          <ChevronDown className="size-3" />
        </Button>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close export menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-md">
              {CSV_SECTIONS.map((s) => (
                <a
                  key={s.key}
                  href={`/api/reports/export?section=${s.key}`}
                  download
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-3.5" />
        PDF
      </Button>
    </div>
  )
}
