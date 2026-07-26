"use client"

import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions"

// Groups the flat permission catalog by its "domain:" prefix into labelled
// sections of checkboxes. Controlled: parent owns the selected set.
function groupByDomain(): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {}
  for (const p of PERMISSIONS) {
    const domain = p.split(":")[0]
    ;(groups[domain] ??= []).push(p)
  }
  return groups
}

export function PermissionEditor({
  selected,
  onChange,
  disabled,
}: {
  selected: Set<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
}) {
  const groups = groupByDomain()

  function toggle(p: Permission) {
    const next = new Set(selected)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    onChange(next)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(groups).map(([domain, perms]) => (
        <div key={domain} className="rounded-lg border border-border/60 p-2">
          <p className="mb-1 text-xs font-medium capitalize text-foreground">{domain}</p>
          <ul className="space-y-1">
            {perms.map((p) => (
              <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selected.has(p)}
                  disabled={disabled}
                  onChange={() => toggle(p)}
                />
                <span>{p.split(":")[1]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
