import { prisma } from "@/lib/prisma"

// One atomic statement in Postgres, comparing against `now() at time zone 'utc'` (see the wiki Security page).

// Only the raw-query surface, so a test transaction can pin a session timezone.
type RateLimitClient = Pick<typeof prisma, "$queryRaw">

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  db: RateLimitClient = prisma
): Promise<boolean> {
  const reset = new Date(Date.now() + windowMs)

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiRateLimit" ("key", "count", "reset")
    VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ApiRateLimit"."reset" <= now() at time zone 'utc' THEN 1 ELSE "ApiRateLimit"."count" + 1 END,
      "reset" = CASE WHEN "ApiRateLimit"."reset" <= now() at time zone 'utc' THEN ${reset} ELSE "ApiRateLimit"."reset" END
    RETURNING "count"
  `

  return (rows[0]?.count ?? 1) <= limit
}

// Expired rows are pruned by the cron sweep, since nothing depends on it running promptly.
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.apiRateLimit.deleteMany({ where: { reset: { lte: new Date() } } })
  return count
}
