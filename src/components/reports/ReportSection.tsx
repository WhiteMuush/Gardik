import type { ReactNode } from "react"

interface ReportSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function ReportSection({ title, description, children }: ReportSectionProps) {
  return (
    <section className="h-full rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}
