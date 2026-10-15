import { ChevronLeft, ChevronRight } from "lucide-react"

export type Role = {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  isAssignable: boolean
}

export const PAGE_SIZE = 8

type Props = {
  filtered: Role[]
  pageRoles: Role[]
  page: number
  pages: number
  setPage: (update: (p: number) => number) => void
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}

export function RolesTable({ filtered, pageRoles, page, pages, setPage, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Permissions
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pageRoles.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                No roles match this search
              </td>
            </tr>
          ) : (
            pageRoles.map((r) => (
              <tr key={r.id} className="group transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{r.name}</span>
                  {r.isSystem && <span className="ml-2 text-xs text-muted-foreground">Built-in</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.permissions.length}</td>
                <td className="px-4 py-3 text-right">
                  {r.isSystem ? (
                    <span className="text-xs text-muted-foreground">&mdash;</span>
                  ) : (
                    <div className="flex justify-end gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        onClick={() => onEdit(r)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(r)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length} role{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <button
            disabled={(page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
