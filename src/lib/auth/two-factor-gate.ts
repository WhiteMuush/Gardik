/**
 * Decides whether a signed-in user must be routed to two-factor enrollment.
 *
 * Kept out of the dashboard layout so the rule is testable on its own: it is a
 * combination of three states, and the one that matters is the one nobody hits
 * by accident (a company that mandates 2FA plus an account that has no password
 * to confirm with).
 */
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

  // Enrollment calls twoFactor.enable, which requires the current password
  // before it issues a TOTP secret. A pre-provisioned SSO account never had
  // one, so forcing it here would strand the user: the form cannot be
  // satisfied, and every other page redirects back to it. The identity
  // provider owns the second factor for those accounts.
  return userHasPassword
}
