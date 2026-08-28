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

// Components that link to a permission-gated API route, and the permission the
// link must be gated on. Hand-maintained on purpose, exactly like
// ROUTE_PERMISSIONS itself: the map does not prove a gate is correct, it forces
// the decision to be made and written down when a link is added.
const API_LINK_PERMISSIONS: Record<string, string> = {
  "components/reports/ReportToolbar.tsx": "reports:export",
  "components/register/ExposureRegister.tsx": "register:evidence",
}

// "${...}" in a template literal and "[param]" in a route key both stand for
// one variable segment. Normalising both is what lets them compare.
function normalise(path: string): string {
  return path.replace(/\$\{[^}]*\}/g, "*").replace(/\[[^\]]*\]/g, "*")
}

// A path counts when it appears as a literal within a short window after an
// `href`, which is what makes it something the reader can click. The window
// spans newlines, so an attribute Prettier wrapped onto its own line is
// still seen. A fetch() to the same route is deliberately out of scope: it
// is not an affordance, the server refuses it on its own, and there is no
// button to withdraw.
const HREF_LITERAL = /href[\s\S]{0,80}?["'`](\/[^"'`\s]*)["'`]/g

function linkedPaths(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(HREF_LITERAL)) {
    found.push(match[1].split(/[?#]/)[0])
  }
  return found
}

const GATED_PAGES = new Set(
  Object.entries(PAGE_PERMISSIONS)
    .filter(([, permission]) => permission !== "AUTH_ONLY")
    .map(([path]) => path)
)

// The app resolves a page's permission by longest matching prefix
// (requiredPermissionForPage in page-permissions.ts), so a gated section's
// rule governs every page below it, not just the section path itself. A
// link to a detail page, /employees/<id> and the like, is the realistic
// case: it matches no entry in GATED_PAGES by equality, so exact-equality
// alone would let it slip past this file unseen.
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

// The limit, stated so nobody reads more into a green run than is there: these
// assertions prove a file received the means to gate its links, not that it
// gated the right one. They catch the omission, which is the failure that
// actually happened: three checklist buttons and two download buttons shipped
// pointing at refusals, and nothing said a word.
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

  // The other way to put someone in front of a refusal, and the one the href
  // rule above cannot see: sending them there in code. Signing in used to do
  // exactly this, hardcoding /dashboard for a role that might not hold
  // dashboard:read. The site root resolves the destination from the role now,
  // so a redirect to a gated page is always the wrong instrument.
  it("never sends someone to a gated page in code", () => {
    const NAVIGATION = /(?:redirect|router\.(?:push|replace))\(\s*["'`](\/[^"'`\s]*)["'`]/g
    const offenders: string[] = []
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(NAVIGATION)) {
        const path = match[1].split(/[?#]/)[0]
        if (isGatedPage(path)) offenders.push(`${relative(SRC, file)} -> ${path}`)
      }
    }
    expect(
      offenders,
      `Redirects to a permission-gated page, route through "/" instead: ${offenders.join(", ")}`
    ).toEqual([])
  })

  it("every declared API link names the permission its route actually enforces", () => {
    for (const [file, permission] of Object.entries(API_LINK_PERMISSIONS)) {
      const enforced = apiLinks(readFileSync(join(SRC, file), "utf8")).map((path) =>
        GATED_API.get(path)
      )
      expect(enforced, file).toContain(permission)
    }
  })
})
