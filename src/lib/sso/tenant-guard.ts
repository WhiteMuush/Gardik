// The only thing standing between company A's IdP and company B's data. An
// unbound provider (no organizationId) is refused rather than treated as
// wildcard: a row without a company is a misconfiguration, not a permission.
export function isSameTenant(
  userCompanyId: string,
  providerOrganizationId: string | null | undefined
): boolean {
  if (!providerOrganizationId) return false
  return providerOrganizationId === userCompanyId
}
