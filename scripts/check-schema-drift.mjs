// Fails when schema.prisma differs from what the migrations build, which means a schema change without its migration.
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import pg from "pg"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const url = process.env.DATABASE_URL
if (!url) {
  console.error("[schema-drift] DATABASE_URL is not set")
  process.exit(1)
}

const shadow = new URL(url)
const name = `${shadow.pathname.slice(1)}_shadow`
shadow.pathname = `/${name}`

// Prisma resets the shadow database on every diff, so it only has to exist.
const client = new pg.Client({ connectionString: url })
await client.connect()
const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])
if (!rowCount) await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`)
await client.end()

const args = ["prisma", "migrate", "diff", "--from-migrations", "prisma/migrations"]
args.push("--to-schema", "prisma/schema.prisma", "--exit-code")
try {
  execFileSync("npx", args, { stdio: "inherit", env: { ...process.env, SHADOW_DATABASE_URL: shadow.href } })
  console.log("[schema-drift] OK: the migrations build schema.prisma exactly")
} catch (err) {
  if (err.status === 2)
    console.error("[schema-drift] schema.prisma changed without a migration, run prisma migrate dev")
  process.exit(1)
}
