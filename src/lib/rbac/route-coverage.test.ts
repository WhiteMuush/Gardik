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

// Every exported handler counts, since a GET is the half that leaks data.
const HANDLER = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/

describe("route->permission coverage", () => {
  it("every API route declares a permission (or is explicitly PUBLIC/AUTH_ONLY)", () => {
    const missing: string[] = []
    for (const { key, file } of routeFiles(API_DIR)) {
      if (!HANDLER.test(readFileSync(file, "utf8"))) continue
      if (!(key in ROUTE_PERMISSIONS)) missing.push(key)
    }
    expect(missing, `Unregistered routes: ${missing.join(", ")}`).toEqual([])
  })

  // A GET on a bare session check beside a gated POST once let eight endpoints leak data.
  it("a route that declares a permission never falls back to a bare session check", () => {
    // These two authenticate on their own terms: minting a step-up grant, and a forced password rotation.
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
