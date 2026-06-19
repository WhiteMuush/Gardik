import type { ReactNode } from "react"

interface ReportSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function ReportSection({ title, description, children }: ReportSectionProps) {
  return (
    <section className="h-full rounded-xl border border-border bg-card">
      {/* Natural-height probe: stays content-sized even when the section is
          stretched to fill a taller grid cell, so the canvas can measure the
          intrinsic content height (the resize floor) instead of the cell. */}
      <div data-measure className="@container p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
