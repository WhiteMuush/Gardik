import bcrypt from "bcryptjs"

// A real cost-12 bcrypt hash of an unused string, hardcoded so importing stays free and the cost is the same everywhere.
const DUMMY_HASH = "$2b$12$u2BV.9KM1ihUdGJRG4WHmuxBxTutlrQ63e3L8r4Cv3xfj7QdybW8e"

// Floor for every password check, since a fast failure revealed that an address had no password to guess.
export const MIN_VERIFY_MS = 350

// Spends a real comparison's time and fails, for an unknown address or an SSO-only account with no password.
export async function burnPasswordTime(password: string): Promise<false> {
  await bcrypt.compare(password, DUMMY_HASH)
  return false
}

// Applied to the whole check, since delaying only rejections would make the fast answer the correct one.
export async function notFasterThan<T>(ms: number, work: Promise<T>): Promise<T> {
  const started = Date.now()
  const result = await work
  const remaining = ms - (Date.now() - started)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  return result
}
