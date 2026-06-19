// Shown instantly while a dashboard page's server data loads, so navigation
// feels immediate. Routes are also prefetched (see RoutePrefetcher), so only
// the dynamic data fetch remains, and this skeleton covers it.
export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-72 animate-pulse rounded bg-muted/70" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="flex-1 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/70" />
          ))}
        </div>
      </div>
    </div>
  )
}
