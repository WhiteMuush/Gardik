// Index scans instead of a regex, which would be open to polynomial ReDoS (CodeQL js/polynomial-redos).
export function isEmail(value: string): boolean {
  if (value.length > 254 || /\s/.test(value)) return false
  const at = value.indexOf("@")
  if (at <= 0 || at !== value.lastIndexOf("@")) return false
  const domain = value.slice(at + 1)
  const dot = domain.lastIndexOf(".")
  return dot > 0 && dot < domain.length - 1
}
