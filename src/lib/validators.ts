// Linear, backtracking-free email check. A regex like
// /^[^\s@]+@[^\s@]+\.[^\s@]+$/ has overlapping quantifiers and is vulnerable to
// polynomial ReDoS on attacker-supplied input (CodeQL js/polynomial-redos), so
// validation is done with index scans instead.
export function isEmail(value: string): boolean {
  if (value.length > 254 || /\s/.test(value)) return false
  const at = value.indexOf("@")
  if (at <= 0 || at !== value.lastIndexOf("@")) return false
  const domain = value.slice(at + 1)
  const dot = domain.lastIndexOf(".")
  return dot > 0 && dot < domain.length - 1
}
