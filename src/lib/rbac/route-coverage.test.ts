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
})
