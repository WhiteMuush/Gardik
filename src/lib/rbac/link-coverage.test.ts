import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { PAGE_PERMISSIONS } from "./page-permissions"
import { ROUTE_PERMISSIONS } from "./route-permissions"

const SRC = join(process.cwd(), "src")

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full))
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

// Hand-maintained like ROUTE_PERMISSIONS, so adding a gated link forces its permission to be written down.
const API_LINK_PERMISSIONS: Record<string, string> = {
  "components/reports/ReportToolbar.tsx": "reports:export",
  "components/register/ExposureRegister.tsx": "register:evidence",
}

// "${...}" and "[param]" both stand for one variable segment, so both normalise to the same token.
function normalise(path: string): string {
  return path.replace(/\$\{[^}]*\}/g, "*").replace(/\[[^\]]*\]/g, "*")
}

// A path counts when it follows an `href` within a short window that spans wrapped lines; fetch() is out of scope.
const HREF_LITERAL = /href[\s\S]{0,80}?["'`](\/[^"'`\s]*)["'`]/g

function linkedPaths(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(HREF_LITERAL)) {
    const path = match[1]?.split(/[?#]/)[0]
    if (path) found.push(path)
  }
  return found
}

const GATED_PAGES = new Set(
  Object.entries(PAGE_PERMISSIONS)
    .filter(([, permission]) => permission !== "AUTH_ONLY")
    .map(([path]) => path)
)

// Matches by longest prefix like requiredPermissionForPage, so detail pages such as /employees/<id> are caught.
function isGatedPage(path: string): boolean {
  return GATED_PAGES.has(path) || [...GATED_PAGES].some((p) => path.startsWith(`${p}/`))
}

const GATED_API = new Map(
  Object.entries(ROUTE_PERMISSIONS)
    .filter(([, permission]) => permission !== "PUBLIC" && permission !== "AUTH_ONLY")
    .map(([key, permission]) => [normalise(`/api/${key}`), permission])
)

function apiLinks(source: string): string[] {
  return linkedPaths(source)
    .filter((path) => path.startsWith("/api/"))
    .map(normalise)
    .filter((path) => GATED_API.has(path))
}

// These tests prove a file can gate its links, not that it gates the right one: they catch the omission.
describe("link -> permission coverage", () => {
  it("a file linking to a gated page receives the visible list", () => {
    const offenders: string[] = []
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8")
      if (!linkedPaths(source).some((path) => isGatedPage(path))) continue
      if (!source.includes("visible.includes(")) offenders.push(relative(SRC, file))
    }
    expect(
      offenders,
      `Files linking to a permission-gated page without filtering on visible: ${offenders.join(", ")}`
    ).toEqual([])
  })

  it("a file linking to a gated API route declares the permission it gates on", () => {
    const undeclared: string[] = []
    for (const file of tsxFiles(SRC)) {
      if (apiLinks(readFileSync(file, "utf8")).length === 0) continue
      const key = relative(SRC, file).split("\\").join("/")
      if (!(key in API_LINK_PERMISSIONS)) undeclared.push(key)
    }
    expect(
      undeclared,
      `Files linking to a permission-gated API route with no API_LINK_PERMISSIONS entry: ${undeclared.join(", ")}`
    ).toEqual([])
  })

  // A redirect in code to a gated page is never right, since the site root resolves the landing from the role.
  it("never sends someone to a gated page in code", () => {
    const NAVIGATION = /(?:redirect|router\.(?:push|replace))\(\s*["'`](\/[^"'`\s]*)["'`]/g
    const offenders: string[] = []
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(NAVIGATION)) {
        const path = match[1]?.split(/[?#]/)[0]
        if (path && isGatedPage(path)) offenders.push(`${relative(SRC, file)} -> ${path}`)
      }
    }
    expect(
      offenders,
      `Redirects to a permission-gated page, route through "/" instead: ${offenders.join(", ")}`
    ).toEqual([])
  })

  it("every declared API link names the permission its route actually enforces", () => {
    for (const [file, permission] of Object.entries(API_LINK_PERMISSIONS)) {
      const enforced = apiLinks(readFileSync(join(SRC, file), "utf8")).map((path) => GATED_API.get(path))
      expect(enforced, file).toContain(permission)
    }
  })
})
