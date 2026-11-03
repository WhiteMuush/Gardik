import type { ReactNode } from "react"
import { Search, Download } from "lucide-react"
import type { RiskLevel } from "@/lib/employees"

const RISK_LEVELS: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "OK"]

type Props = {
  search: string
  setSearch: (value: string) => void
  department: string
  setDepartment: (value: string) => void
  riskFilter: string
  setRiskFilter: (value: string) => void
  departments: string[]
  canExport: boolean
  onExport: () => void
  saveView: ReactNode
}

export function EmployeeFilters({
  search,
  setSearch,
  department,
  setDepartment,
  riskFilter,
  setRiskFilter,
  departments,
  canExport,
  onExport,
  saveView,
}: Props) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={riskFilter}
        onChange={(e) => setRiskFilter(e.target.value)}
        className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
      >
        <option value="">All risk levels</option>
        {RISK_LEVELS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {saveView}
      <button
        onClick={onExport}
        disabled={!canExport}
        className="ml-auto flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <Download className="size-4" />
        Export CSV
      </button>
    </div>
  )
}
