import { X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DetailField, DetailPayload, DetailVariant } from "@/contexts/DetailDrawerContext"

const dotColor: Record<DetailVariant, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  ok: "bg-severity-ok",
  default: "bg-muted-foreground",
}

type Props = {
  payload: DetailPayload
  loading: boolean
  onClose: () => void
}

export function DetailDrawerBody({ payload, loading, onClose }: Props) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {payload.variant && (
              <span className={cn("size-2 shrink-0 rounded-full", dotColor[payload.variant])} />
            )}
            <h2 className="truncate text-sm font-semibold text-foreground">{payload.title}</h2>
            {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>
          {payload.subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{payload.subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {payload.tags && payload.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {payload.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {payload.fields && <FieldList fields={payload.fields} />}

        {payload.groups?.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {g.heading && <p className="mb-1 text-xs font-semibold text-foreground">{g.heading}</p>}
            <FieldList fields={g.fields} />
          </div>
        ))}

        {loading && (!payload.groups || payload.groups.length === 0) && !payload.fields && (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading details...</p>
        )}
      </div>
    </>
  )
}

function FieldList({ fields }: { fields: DetailField[] }) {
  return (
    <dl className="divide-y divide-border">
      {fields.map((f, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {f.label}
          </dt>
          <dd className="text-right text-xs font-medium text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
