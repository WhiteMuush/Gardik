import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ROUTE_PERMISSIONS } from "./route-permissions"

const API_DIR = join(process.cwd(), "src/app/api")

function routeFiles(dir: string, base = ""): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full, join(base, entry)))
    else if (entry === "route.ts") out.push({ key: base.replace(/\\/g, "/"), file: full })
  }
  return out
}

const MUTATING = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/

describe("route->permission coverage", () => {
  it("every mutating API route declares a permission (or is explicitly PUBLIC/AUTH_ONLY)", () => {
    const missing: string[] = []
    for (const { key, file } of routeFiles(API_DIR)) {
      if (!MUTATING.test(readFileSync(file, "utf8"))) continue
      if (!(key in ROUTE_PERMISSIONS)) missing.push(key)
    }
    expect(missing, `Unregistered mutating routes: ${missing.join(", ")}`).toEqual([])
  })

  // The gap that let eight read endpoints serve the company's data to a role
  // holding nothing: the checks above only ever looked at mutating handlers, so
  // a GET could sit on requireAuth (any valid session) while the POST beside it
  // demanded a permission, and nothing noticed. Pages were fixed; the APIs
  // behind them were not.
  it("a route that declares a permission never falls back to a bare session check", () => {
    // Two endpoints authenticate on their own terms and are documented as
    // doing so: minting a step-up grant, and setting a new password under a
    // forced rotation, which the permission guard itself refuses.
    const OWN_TERMS = new Set(["rbac/step-up", "account/password"])
    const offenders: string[] = []
    for (const { key, file } of routeFiles(API_DIR)) {
      const permission = ROUTE_PERMISSIONS[key]
      if (!permission || permission === "PUBLIC" || permission === "AUTH_ONLY") continue
      if (OWN_TERMS.has(key)) continue
      if (/await\s+requireAuth\(\)/.test(readFileSync(file, "utf8"))) offenders.push(key)
    }
    expect(
      offenders,
      `Routes mapped to a permission but still calling requireAuth(): ${offenders.join(", ")}`
    ).toEqual([])
  })

  it("every route mapped to a real permission actually enforces it with requirePermission", () => {
    const files = new Map(routeFiles(API_DIR).map(({ key, file }) => [key, file]))
    const unenforced: string[] = []
    for (const [key, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      if (permission === "PUBLIC" || permission === "AUTH_ONLY") continue
      const file = files.get(key)
      if (!file) continue
      const source = readFileSync(file, "utf8")
      if (!source.includes(`requirePermission("${permission}")`)) unenforced.push(key)
    }
    expect(
      unenforced,
      `Routes mapped to a permission but not enforcing it via requirePermission(...): ${unenforced.join(", ")}`
    ).toEqual([])
  })
})
