import { createLocalAccountIssuer } from "better-auth/db"

/**
 * Issuer stamped on password accounts. Better Auth 1.7 looks accounts up by
 * (issuer, accountId), so a row written by hand (an invitation being accepted,
 * a seed) has to carry the same value the library would have written itself.
 * Derived from the library rather than spelled out, so a change upstream is a
 * type error here and not a silent sign-in failure.
 */
export const CREDENTIAL_ISSUER = createLocalAccountIssuer("credential")
