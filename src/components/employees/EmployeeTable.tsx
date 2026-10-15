"use client"

import { useState, useMemo } from "react"
import { flexRender, type SortingState } from "@tanstack/react-table"
// The v9 /legacy entry keeps the v8 hook as a shim; port to useTable before v10 removes it.
import {
  useLegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table/legacy"
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { EmployeeDrawer } from "@/components/employees/EmployeeDrawer"
import type { EmployeeRow } from "@/lib/employees"
import { downloadCsv } from "@/lib/csv"
import { columns } from "./employee-columns"
import { EmployeeFilters } from "./EmployeeFilters"

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
        !q || e.email.toLowerCase().includes(q) || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
      const matchDept = !department || e.department === department
      const matchRisk = !riskFilter || e.riskLevel === riskFilter
      return matchSearch && matchDept && matchRisk
    })
  }, [data, search, department, riskFilter])

  function exportCsv() {
    downloadCsv(
      "gardik-employees.csv",
      ["name", "email", "department", "risk", "breaches", "exposed data", "last detected"],
      filtered.map((e) => [
        `${e.firstName} ${e.lastName}`,
        e.email,
        e.department ?? "",
        e.riskLevel,
        e.breachCount,
        e.exposedDataTypes.join("; "),
        e.lastDetectedAt ? new Date(e.lastDetectedAt).toISOString().slice(0, 10) : "",
      ])
    )
  }

  const table = useLegacyTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
  })

  return (
    <>
      <EmployeeFilters
        search={search}
        setSearch={setSearch}
        department={department}
        setDepartment={setDepartment}
        riskFilter={riskFilter}
        setRiskFilter={setRiskFilter}
        departments={departments}
        canExport={filtered.length > 0}
        onExport={exportCsv}
      />

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
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
