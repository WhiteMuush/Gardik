// The no-escalation rule: an actor can only put into a role, or assign, a set of
// permissions that is a subset of the permissions the actor themselves hold. This
// stops a role manager from minting a role more powerful than their own and
// granting it (to a puppet account or to themselves via reassignment).

export function excessPermissions(
  actorPerms: ReadonlySet<string>,
  target: Iterable<string>,
): string[] {
  const excess: string[] = []
  for (const p of target) if (!actorPerms.has(p)) excess.push(p)
  return excess
}

export function isSubsetOf(actorPerms: ReadonlySet<string>, target: Iterable<string>): boolean {
  return excessPermissions(actorPerms, target).length === 0
}
