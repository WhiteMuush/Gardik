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

  const [{ bootstrapFirstAdmin }, { prisma }] = await Promise.all([
    import("@/lib/auth/bootstrap"),
    import("@/lib/prisma"),
  ])
  await bootstrapFirstAdmin(prisma)
}
