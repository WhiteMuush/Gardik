"use client"

import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table"
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { RiskBadge } from "@/components/ui/RiskBadge"
import { EmployeeDrawer } from "@/components/employees/EmployeeDrawer"
import type { EmployeeRow, RiskLevel } from "@/lib/employees"
import { cn } from "@/lib/utils"

const col = createColumnHelper<EmployeeRow>()

const columns = [
  col.accessor((r) => `${r.firstName} ${r.lastName}`, {
    id: "name",
    header: "Name",
    cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
  }),
  col.accessor("email", {
    header: "Email",
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  col.accessor("department", {
    header: "Department",
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  col.accessor("riskLevel", {
    header: "Risk",
    cell: (info) => <RiskBadge level={info.getValue() as RiskLevel} />,
  }),
  col.accessor("breachCount", {
    header: "Breaches",
    cell: (info) => (
      <span className={cn("font-medium tabular-nums", info.getValue() > 0 ? "text-severity-high" : "text-muted-foreground")}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor("lastDetectedAt", {
    header: "Last detected",
    cell: (info) => {
      const val = info.getValue()
      return val
        ? new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : <span className="text-muted-foreground">—</span>
    },
  }),
]

const RISK_LEVELS: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "OK"]

export function EmployeeTable({ data }: { data: EmployeeRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("")
  const [riskFilter, setRiskFilter] = useState("")
  const [selected, setSelected] = useState<EmployeeRow | null>(null)

  const departments = useMemo(
    () => [...new Set(data.map((e) => e.department).filter(Boolean) as string[])].sort(),
    [data]
  )

  const filtered = useMemo(() => {
    return data.filter((e) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q || e.email.toLowerCase().includes(q) ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
      const matchDept = !department || e.department === department
      const matchRisk = !riskFilter || e.riskLevel === riskFilter
      return matchSearch && matchDept && matchRisk
    })
  }, [data, search, department, riskFilter])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search name or email…"
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
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ChevronUp className="size-3" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                  No employees found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row.original)}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <EmployeeDrawer employee={selected} onClose={() => setSelected(null)} />
    </>
  )
}
