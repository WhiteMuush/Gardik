/**
 * Next runs this once per server process, before the first request. The only
 * thing wired here is the first-administrator bootstrap, which decides for
 * itself whether it has anything to do; see src/lib/auth/bootstrap.ts.
 *
 * The runtime check matters: Next also loads this file in the edge runtime,
 * where Prisma cannot open a connection.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  try {
    const [{ bootstrapFirstAdmin }, { prisma }] = await Promise.all([
      import("@/lib/auth/bootstrap"),
      import("@/lib/prisma"),
    ])
    await bootstrapFirstAdmin(prisma)
  } catch (error) {
    // bootstrapFirstAdmin swallows its own failures, but it cannot swallow the
    // ones that happen before it is reachable: loading @/lib/prisma constructs a
    // client from DATABASE_URL and throws on a missing or malformed one, which is
    // precisely the misconfigured deploy this hook exists to survive.
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[bootstrap] Skipped: ${detail}.`)
  }
}
