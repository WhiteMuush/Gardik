import { legacyCreateColumnHelper, type LegacyColumnDef } from "@tanstack/react-table/legacy"
import { RiskBadge } from "@/components/ui/RiskBadge"
import type { EmployeeRow, RiskLevel } from "@/lib/employees"
import { cn } from "@/lib/utils"

const col = legacyCreateColumnHelper<EmployeeRow>()

// v9 ColumnDef is invariant in TValue, so a mixed-value array needs `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const columns: LegacyColumnDef<EmployeeRow, any>[] = [
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
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">-</span>,
  }),
  col.accessor("riskLevel", {
    header: "Risk",
    cell: (info) => <RiskBadge level={info.getValue() as RiskLevel} />,
  }),
  col.accessor("breachCount", {
    header: "Breaches",
    cell: (info) => (
      <span
        className={cn(
          "font-medium tabular-nums",
          info.getValue() > 0 ? "text-severity-high" : "text-muted-foreground"
        )}
      >
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor("lastDetectedAt", {
    header: "Last detected",
    cell: (info) => {
      const val = info.getValue()
      return val ? (
        new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
  }),
]
