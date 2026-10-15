import type { Dispatch, SetStateAction } from "react"
import { PermissionEditor } from "./PermissionEditor"

type Props = {
  editingName: string | null
  name: string
  setName: (name: string) => void
  perms: Set<string>
  setPerms: Dispatch<SetStateAction<Set<string>>>
  error: string | null
  onCancel: () => void
  onSave: () => void
}

export function RoleForm({ editingName, name, setName, perms, setPerms, error, onCancel, onSave }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {editingName !== null ? `Edit ${editingName}` : "New role"}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{perms.size} selected</span>
      </div>

      <input
        placeholder="Role name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
      />

      <PermissionEditor selected={perms} onChange={setPerms} />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  )
}
