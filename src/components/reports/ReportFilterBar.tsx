"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition } from "react"
import { X, Filter } from "lucide-react"
import { NO_DEPARTMENT, filtersToQuery, hasActiveFilters, type ReportFilters } from "@/lib/reports/filters"

type DataTypeOption = { key: string; label: string }

const fieldCls =
  "h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-primary"

export function ReportFilterBar({
  filters,
  departments,
  dataTypes,
}: {
  filters: ReportFilters
  departments: string[]
  dataTypes: DataTypeOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const apply = (next: ReportFilters) => {
    const qs = filtersToQuery(next)
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  const set = (patch: Partial<ReportFilters>) => apply({ ...filters, ...patch })

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="size-3.5" />
        Filters
      </span>

      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        From
        <input
          type="date"
          value={filters.from ?? ""}
          max={filters.to ?? undefined}
          onChange={(e) => set({ from: e.target.value || null })}
          className={fieldCls}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        To
        <input
          type="date"
          value={filters.to ?? ""}
          min={filters.from ?? undefined}
          onChange={(e) => set({ to: e.target.value || null })}
          className={fieldCls}
        />
      </label>

      <select
        value={filters.department ?? ""}
        onChange={(e) => set({ department: e.target.value || null })}
        className={fieldCls}
        aria-label="Department"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d === "Unknown" ? NO_DEPARTMENT : d}>
            {d}
          </option>
        ))}
      </select>

      <select
        value={filters.dataType ?? ""}
        onChange={(e) => set({ dataType: e.target.value || null })}
        className={fieldCls}
        aria-label="Data type"
      >
        <option value="">All data types</option>
        {dataTypes.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => apply({ from: null, to: null, department: null, dataType: null })}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
      {pending && <span className="text-xs text-muted-foreground">...</span>}
    </div>
  )
}
