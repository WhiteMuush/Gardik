import { prisma } from "@/lib/prisma"

// Backed by Postgres rather than a per-process Map. In memory the limit was
// silently multiplied by the number of running instances and reset on every
// deploy, which makes it decorative on anything but a single long-lived node.
//
// One statement does the whole thing, so two concurrent requests cannot both
// read a stale count and both decide they are under the limit: the row is
// locked by the UPDATE and the window rolls over inside the same statement.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const reset = new Date(Date.now() + windowMs)

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiRateLimit" ("key", "count", "reset")
    VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ApiRateLimit"."reset" <= now() THEN 1 ELSE "ApiRateLimit"."count" + 1 END,
      "reset" = CASE WHEN "ApiRateLimit"."reset" <= now() THEN ${reset} ELSE "ApiRateLimit"."reset" END
    RETURNING "count"
  `

  return (rows[0]?.count ?? 1) <= limit
}

// Expired rows are dead weight once their window has passed. Nothing depends on
// this running promptly, so it rides along with the existing cron sweep.
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.apiRateLimit.deleteMany({ where: { reset: { lte: new Date() } } })
  return count
}
