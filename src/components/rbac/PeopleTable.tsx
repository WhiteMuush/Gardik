export type UserRow = {
  id: string
  email: string
  name: string
  roleId: string | null
  roleName: string | null
}
// grantable comes from the server and already folds in the no-escalation rule,
// so the dropdown never offers a role the assignment call would refuse.
export type RoleRow = { id: string; name: string; isAssignable: boolean; grantable: boolean }

type Props = {
  filtered: UserRow[]
  roles: RoleRow[]
  onAssign: (userId: string, roleId: string | null) => void
  onInvite: (userId: string) => void
  onRequirePasswordChange: (userId: string) => void
}

export function PeopleTable({ filtered, roles, onAssign, onInvite, onRequirePasswordChange }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Person
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Credentials
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                No one matches this search
              </td>
            </tr>
          ) : (
            filtered.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{u.name || u.email}</span>
                  {u.name && <span className="ml-2 text-muted-foreground">{u.email}</span>}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.roleId ?? ""}
                    onChange={(e) => onAssign(u.id, e.target.value || null)}
                    className="rounded-lg border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none"
                  >
                    <option value="">No access</option>
                    {roles
                      .filter((r) => r.grantable)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onInvite(u.id)}
                      className="rounded-lg border border-input px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60"
                    >
                      Send invitation
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequirePasswordChange(u.id)}
                      className="rounded-lg border border-input px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60"
                    >
                      Force new password
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
        </p>
      </div>
    </div>
  )
}
