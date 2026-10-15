// Runs the first-administrator bootstrap once per server process, on the Node runtime only since Prisma cannot run on edge.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  try {
    const [{ bootstrapFirstAdmin }, { prisma }] = await Promise.all([
      import("@/lib/auth/bootstrap"),
      import("@/lib/prisma"),
    ])
    await bootstrapFirstAdmin(prisma)
  } catch (error) {
    // Loading @/lib/prisma throws on a bad DATABASE_URL before bootstrapFirstAdmin can swallow it, so it is caught here.
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[bootstrap] Skipped: ${detail}.`)
  }
}
