// The only barrier between one company's IdP and another's data, so an unbound provider is refused.
export function isSameTenant(
  userCompanyId: string,
  providerOrganizationId: string | null | undefined
): boolean {
  if (!providerOrganizationId) return false
  return providerOrganizationId === userCompanyId
}
