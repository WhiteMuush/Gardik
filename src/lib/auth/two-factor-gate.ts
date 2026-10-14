// Decides whether a signed-in user must enroll in 2FA, kept here so the three-state rule is testable alone.
export function needsTwoFactorEnrollment({
  companyRequires2fa,
  userHasTwoFactor,
  userHasPassword,
}: {
  companyRequires2fa: boolean
  userHasTwoFactor: boolean
  /** A credential account exists, i.e. the user can sign in with a password. */
  userHasPassword: boolean
}): boolean {
  if (!companyRequires2fa || userHasTwoFactor) return false

  // Enrollment needs the current password, so an SSO account without one is left to its identity provider.
  return userHasPassword
}
