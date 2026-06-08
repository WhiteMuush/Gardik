"use client"

import { cn } from "@/lib/utils"
import { RiskBadge } from "@/components/ui/RiskBadge"
import type { EmployeeRow } from "@/lib/employees"
import { X, Calendar, Shield } from "lucide-react"

const sourceLabels: Record<string, string> = {
  HIBP: "Have I Been Pwned",
  MANUAL: "Manual",
  DARK_WEB: "Dark Web",
}

interface EmployeeDrawerProps {
  employee: EmployeeRow | null
  onClose: () => void
}

export function EmployeeDrawer({ employee, onClose }: EmployeeDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm transition-opacity duration-300",
          employee ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300",
          employee ? "translate-x-0" : "translate-x-full"
        )}
      >
        {employee && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {employee.firstName} {employee.lastName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{employee.email}</p>
                <div className="mt-2">
                  <RiskBadge level={employee.riskLevel} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
              <div className="bg-card p-4">
                <p className="text-xs text-muted-foreground">Breaches</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{employee.breachCount}</p>
              </div>
              <div className="bg-card p-4">
                <p className="text-xs text-muted-foreground">Exposed types</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {employee.exposedDataTypes.length}
                </p>
              </div>
            </div>

            {/* Exposed data types */}
            {employee.exposedDataTypes.length > 0 && (
              <div className="border-b border-border p-5">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Exposed data
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {employee.exposedDataTypes.map((type) => (
                    <span
                      key={type}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-foreground"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Breach timeline */}
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Breach history
              </p>
              {employee.breachRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">No breaches recorded.</p>
              ) : (
                <div className="space-y-4">
                  {employee.breachRecords.map((record) => (
                    <div key={record.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{record.breachName}</p>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {sourceLabels[record.source] ?? record.source}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Shield className="size-3" />
                          Breach date:{" "}
                          {new Date(record.breachDate).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          Detected:{" "}
                          {new Date(record.detectedAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {record.exposedData.map((type) => (
                          <span
                            key={type}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
