import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

type Props<F extends string> = {
  noun: string
  query: string
  onQuery: (query: string) => void
  filters: F[]
  filter: F
  onFilter: (filter: F) => void
}

export function CatalogToolbar<F extends string>({
  noun,
  query,
  onQuery,
  filters,
  filter,
  onFilter,
}: Props<F>) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder={`Search ${noun}...`}
          aria-label={`Search ${noun}`}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Filter ${noun}`}>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => onFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  )
}
