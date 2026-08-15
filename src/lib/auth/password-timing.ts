import bcrypt from "bcryptjs"

/**
 * A real bcrypt hash at cost 12, of a string nothing uses. Comparing against it
 * costs exactly what comparing against a genuine hash costs, which is the point:
 * it is burned when there is no genuine hash to compare against.
 *
 * Hard-coded rather than generated at startup so importing this module stays
 * free, and so the cost is the same in every process.
 */
const DUMMY_HASH = "$2b$12$u2BV.9KM1ihUdGJRG4WHmuxBxTutlrQ63e3L8r4Cv3xfj7QdybW8e"

/**
 * The floor every password check is held to.
 *
 * bcrypt at cost 12 already takes roughly a quarter of a second on this
 * hardware, and that work is the real defence: it is what makes guessing
 * expensive rather than free. The floor exists for the other half of the
 * problem, which is that failures used to be *fast* when there was nothing to
 * compare against, and a fast answer told an attacker "this address has no
 * account here" without them guessing a single password.
 */
export const MIN_VERIFY_MS = 350

/**
 * Spends the same time a real comparison would, and always fails.
 *
 * Called when there is no stored hash: an unknown address, or an account that
 * signs in through an identity provider and has no password at all. Returning
 * early there is what turns a login form into an account directory.
 */
export async function burnPasswordTime(password: string): Promise<false> {
  await bcrypt.compare(password, DUMMY_HASH)
  return false
}

/**
 * Resolves no sooner than `ms` after it was called.
 *
 * Applied to the whole check, not to failures only. Delaying just the rejection
 * would recreate the very signal it is meant to hide, in the other direction:
 * whatever answers quickly is then the correct one.
 */
export async function notFasterThan<T>(ms: number, work: Promise<T>): Promise<T> {
  const started = Date.now()
  const result = await work
  const remaining = ms - (Date.now() - started)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  return result
}
