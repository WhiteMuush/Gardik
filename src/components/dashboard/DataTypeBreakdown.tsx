interface DataTypeBreakdownProps {
  data: { type: string; count: number; percentage: number }[]
}

export function DataTypeBreakdown({ data }: DataTypeBreakdownProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground">Exposed Data Types</h2>
        <p className="text-xs text-muted-foreground">
          Distribution of compromised data categories
        </p>
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data exposures detected
        </p>
      ) : (
        <div className="space-y-3">
          {data.map(({ type, count, percentage }) => (
            <div key={type}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm capitalize text-foreground">{type}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count} exposure{count > 1 ? "s" : ""} · {percentage}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
