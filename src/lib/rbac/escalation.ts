// An actor can only put into a role, or assign, permissions they hold themselves.

export function excessPermissions(actorPerms: ReadonlySet<string>, target: Iterable<string>): string[] {
  const excess: string[] = []
  for (const p of target) if (!actorPerms.has(p)) excess.push(p)
  return excess
}

export function isSubsetOf(actorPerms: ReadonlySet<string>, target: Iterable<string>): boolean {
  return excessPermissions(actorPerms, target).length === 0
}
