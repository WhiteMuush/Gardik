import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { PAGE_PERMISSIONS, requiredPermissionForPage, visiblePages, landingPath } from "./page-permissions"
import { isPermission, PERMISSIONS } from "./permissions"

const DASHBOARD_DIR = join(process.cwd(), "src/app/(dashboard)")

// Mirrors Next's mapping: directories become segments, except route groups in parentheses.
function pageRoutes(dir: string, base = ""): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const segment = entry.startsWith("(") ? base : `${base}/${entry}`
      out.push(...pageRoutes(full, segment))
    } else if (entry === "page.tsx") {
      out.push(base === "" ? "/" : base)
    }
  }
  return out
}

describe("page->permission coverage", () => {
  it("every dashboard page declares the permission that opens it", () => {
    const missing = pageRoutes(DASHBOARD_DIR).filter((route) => !(route in PAGE_PERMISSIONS))
    expect(missing, `Dashboard pages with no entry in PAGE_PERMISSIONS: ${missing.join(", ")}`).toEqual([])
  })

  it("declares nothing for a page that no longer exists", () => {
    const routes = new Set(pageRoutes(DASHBOARD_DIR))
    const stale = Object.keys(PAGE_PERMISSIONS).filter((path) => !routes.has(path))
    expect(stale, `Entries pointing at missing pages: ${stale.join(", ")}`).toEqual([])
  })

  // The guard must be in the page, since the layout check cannot stop the page from rendering its data.
  it("every page mapped to a permission calls guardPage with it", () => {
    const unenforced: string[] = []
    for (const [path, permission] of Object.entries(PAGE_PERMISSIONS)) {
      if (permission === "AUTH_ONLY") continue
      const file = join(DASHBOARD_DIR, path, "page.tsx")
      if (!readFileSync(file, "utf8").includes(`guardPage("${permission}")`)) unenforced.push(path)
    }
    expect(
      unenforced,
      `Pages mapped to a permission but not calling guardPage(...): ${unenforced.join(", ")}`
    ).toEqual([])
  })

  it("maps every entry to a real permission or the explicit AUTH_ONLY marker", () => {
    for (const [path, permission] of Object.entries(PAGE_PERMISSIONS)) {
      expect(permission === "AUTH_ONLY" || isPermission(permission), `${path}`).toBe(true)
    }
  })
})

describe("requiredPermissionForPage", () => {
  it("resolves a declared path", () => {
    expect(requiredPermissionForPage("/employees")).toBe("employees:read")
  })

  it("prefers the longest matching prefix, so a section can subdivide", () => {
    expect(requiredPermissionForPage("/dashboard/widgets")).toBe("dashboard:customize")
  })

  it("inherits the section rule for a path below it", () => {
    expect(requiredPermissionForPage("/alerts/abc123")).toBe("alerts:read")
  })

  // An undeclared page must return no answer so the caller refuses, never a permissive default.
  it("returns null for an undeclared path rather than guessing", () => {
    expect(requiredPermissionForPage("/brand-new-page")).toBeNull()
    expect(requiredPermissionForPage("/employeesx")).toBeNull()
  })
})

describe("visiblePages", () => {
  const AUTH_ONLY = Object.keys(PAGE_PERMISSIONS).filter((path) => PAGE_PERMISSIONS[path] === "AUTH_ONLY")
  // Compared sorted, since the contract is which paths come back, not their order.
  const sorted = (paths: string[]) => [...paths].sort()

  it("gives a role holding nothing only the pages about its own account", () => {
    expect(sorted(visiblePages(new Set()))).toEqual(sorted(AUTH_ONLY))
  })

  it("adds the page a held permission opens", () => {
    expect(sorted(visiblePages(new Set(["employees:read"])))).toEqual(sorted(["/employees", ...AUTH_ONLY]))
  })

  it("ignores a permission that guards no page", () => {
    expect(sorted(visiblePages(new Set(["alerts:remediate"])))).toEqual(sorted(AUTH_ONLY))
  })

  it("gives every declared page to a role holding every permission", () => {
    expect(sorted(visiblePages(new Set(PERMISSIONS)))).toEqual(sorted(Object.keys(PAGE_PERMISSIONS)))
  })
})

describe("landingPath", () => {
  it("sends a full role to the dashboard", () => {
    expect(landingPath(new Set(PERMISSIONS))).toBe("/dashboard")
  })

  it("sends a role without dashboard:read to a page it can actually open", () => {
    expect(landingPath(new Set(["alerts:read"]))).toBe("/alerts")
  })

  // A sub-page only comes first for a role with dashboard:customize but not dashboard:read, a misconfigured role.
  it("skips a sub-page in favour of a section root", () => {
    expect(landingPath(new Set(["dashboard:customize"]))).toBe("/security")
  })

  // A role granted nothing still has somewhere to be: its own account.
  it("falls back to the caller's own pages when the role holds nothing", () => {
    expect(landingPath(new Set())).toBe("/security")
  })
})
