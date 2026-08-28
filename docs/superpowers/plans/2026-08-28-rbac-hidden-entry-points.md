# Hiding entry points a role cannot use: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop offering links and buttons that lead to a refusal, without weakening any server guard.

**Architecture:** The dashboard layout already resolves which pages the caller may open. That resolution moves into a named helper, and its result travels down as the `visible` prop the sidebar already takes. Components that link to an API route instead receive a named boolean mirroring the permission that route enforces. A static test then fails the build when a new link appears without either.

**Tech Stack:** Next.js App Router (server components), React 19, Prisma, Vitest for unit and static-analysis tests, Playwright for behaviour.

**Spec:** `docs/superpowers/specs/2026-08-28-rbac-hidden-entry-points-design.md`

## Global Constraints

- Branch: `feat/hide-unauthorized-entry-points`, already cut from `develop` and rebased onto `fix/english-only-sources`. Do not branch again.
- ASCII only, in every file including Markdown. `.githooks/lib/check-ascii-tree.sh` fails the build on any other byte. No em dash, no ellipsis character, no middle dot, no box drawing.
- English only. `.githooks/lib/check-english.sh` rejects accented letters.
- Conventional Commits, subject in lowercase, no trailing period. Allowed types only: `feat|fix|chore|docs|refactor|ci|test|build|perf|style|revert`.
- No AI attribution anywhere in a commit message. `.githooks/lib/check-ai-attribution.sh` rejects it.
- Vitest collects `src/**/*.test.ts` only. There is no `@testing-library/react` and no DOM environment, so **a React component cannot be rendered in a unit test**. Component behaviour is covered by Playwright; component wiring is covered by static analysis. Do not add a rendering test framework.
- `npx tsc --noEmit`, `npm run lint` and `npx vitest run` must all pass before every commit. The pre-commit hook runs lint and the compliance checks itself.

## File Structure

**Created**

- `src/lib/rbac/link-coverage.test.ts` - the regression net. Walks `.tsx` files, finds links to permission-gated targets, and asserts each file received the means to gate them.

**Modified**

- `src/lib/rbac/page-permissions.ts` - gains `visiblePages`, the single definition of "which pages may this permission set open".
- `src/lib/rbac/page-permissions.test.ts` - covers it.
- `src/lib/rbac/route-permissions.ts` - declares `register/[id]/evidence`, which the link test needs in order to see that route as gated.
- `src/app/(dashboard)/layout.tsx` - calls the helper instead of restating it.
- `src/app/(dashboard)/setup/page.tsx` + `src/components/dashboard/SetupChecklist.tsx`
- `src/app/(dashboard)/dashboard/page.tsx` + `src/components/dashboard/DashboardCanvas.tsx`
- `src/app/(dashboard)/dashboard/widgets/page.tsx` + `src/components/dashboard/WidgetLibrary.tsx`
- `src/app/(dashboard)/reports/page.tsx` + `src/components/reports/ReportToolbar.tsx`
- `src/app/(dashboard)/register/page.tsx` + `src/components/register/ExposureRegister.tsx`
- `e2e/seed.ts` - one register entry, so the register assertion is not vacuous.
- `e2e/rbac.spec.ts` - asserts the controls are absent for a read-only role and present for an admin.

Each page/component pair is one task: the server page resolves the permission, the client component consumes the answer. Splitting them would leave a prop with no producer.

---

### Task 1: The `visiblePages` helper

**Files:**
- Modify: `src/lib/rbac/page-permissions.ts` (append at end of file)
- Modify: `src/lib/rbac/page-permissions.test.ts:1-5` (imports) and append a describe block
- Modify: `src/app/(dashboard)/layout.tsx:11` (import) and `:73` (the inline expression)

**Interfaces:**
- Produces: `visiblePages(perms: ReadonlySet<string>): string[]`, exported from `@/lib/rbac/page-permissions`. Returns the keys of `PAGE_PERMISSIONS` the set satisfies, in declaration order, treating `"AUTH_ONLY"` as always satisfied. Every later task consumes it.

- [ ] **Step 1: Write the failing tests**

In `src/lib/rbac/page-permissions.test.ts`, change the two import lines at the top:

```ts
import { PAGE_PERMISSIONS, requiredPermissionForPage, visiblePages } from "./page-permissions"
import { isPermission, PERMISSIONS } from "./permissions"
```

Then append this block at the end of the file:

```ts
describe("visiblePages", () => {
  const AUTH_ONLY = Object.keys(PAGE_PERMISSIONS).filter(
    (path) => PAGE_PERMISSIONS[path] === "AUTH_ONLY"
  )
  // Compared sorted: the contract is which paths come back, not the order
  // PAGE_PERMISSIONS happens to declare them in.
  const sorted = (paths: string[]) => [...paths].sort()

  it("gives a role holding nothing only the pages about its own account", () => {
    expect(sorted(visiblePages(new Set()))).toEqual(sorted(AUTH_ONLY))
  })

  it("adds the page a held permission opens", () => {
    expect(sorted(visiblePages(new Set(["employees:read"])))).toEqual(
      sorted(["/employees", ...AUTH_ONLY])
    )
  })

  it("ignores a permission that guards no page", () => {
    expect(sorted(visiblePages(new Set(["alerts:remediate"])))).toEqual(sorted(AUTH_ONLY))
  })

  it("gives every declared page to a role holding every permission", () => {
    expect(sorted(visiblePages(new Set(PERMISSIONS)))).toEqual(
      sorted(Object.keys(PAGE_PERMISSIONS))
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/rbac/page-permissions.test.ts`
Expected: FAIL, four failures reporting `visiblePages is not a function`.

- [ ] **Step 3: Write the helper**

Append to `src/lib/rbac/page-permissions.ts`:

```ts
/**
 * The declared paths a permission set may open, in declaration order.
 *
 * The dashboard layout resolves this once per request and hands the result to
 * every component that renders links, so no client component re-derives the
 * rule and the two copies cannot drift. AUTH_ONLY counts as satisfied: those
 * pages are about the caller's own account rather than the company's data.
 */
export function visiblePages(perms: ReadonlySet<string>): string[] {
  return Object.keys(PAGE_PERMISSIONS).filter((path) => {
    const permission = PAGE_PERMISSIONS[path]
    return permission === "AUTH_ONLY" || perms.has(permission)
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/rbac/page-permissions.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Call the helper from the layout**

In `src/app/(dashboard)/layout.tsx`, replace the import on line 11:

```ts
import { requiredPermissionForPage, visiblePages } from "@/lib/rbac/page-permissions"
```

and replace the line that reads:

```ts
  const visible = Object.keys(PAGE_PERMISSIONS).filter((path) => may(PAGE_PERMISSIONS[path]))
```

with:

```ts
  const visible = visiblePages(perms)
```

Leave the `may` helper and the `may(requiredPermissionForPage(pathname))` check exactly as they are: they answer a different question, which page the caller is currently on.

- [ ] **Step 6: Verify the whole suite and the types**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc silent, 234 tests passing. If tsc reports `PAGE_PERMISSIONS is declared but never read`, the import on line 11 still lists it; remove it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rbac/page-permissions.ts src/lib/rbac/page-permissions.test.ts "src/app/(dashboard)/layout.tsx"
git commit -m "refactor(rbac): name the visible page set instead of inlining it"
```

---

### Task 2: The setup checklist

**Files:**
- Modify: `src/components/dashboard/SetupChecklist.tsx:22-31` (props) and the `{!step.done && ...}` block
- Modify: `src/app/(dashboard)/setup/page.tsx`

**Interfaces:**
- Consumes: `visiblePages` from Task 1.
- Produces: `SetupChecklist` takes `visible: string[]` alongside its existing `hasEmployees`, `hasApiKey`, `isAdmin` and `children`.

- [ ] **Step 1: Add the prop to the component**

In `src/components/dashboard/SetupChecklist.tsx`, replace the signature:

```tsx
export function SetupChecklist({
  hasEmployees,
  hasApiKey,
  isAdmin,
  visible,
  children,
}: {
  hasEmployees: boolean
  hasApiKey: boolean
  isAdmin: boolean
  /**
   * Paths this role may open, resolved server-side from the same map the
   * layout enforces. A step whose target is not in here keeps its title and
   * description and loses only its link: the person should still learn what
   * the company is missing, which is what the "managed by admins" note below
   * then accounts for.
   */
  visible: string[]
  children?: React.ReactNode
}) {
```

- [ ] **Step 2: Gate the call-to-action link**

In the same file, replace:

```tsx
                {!step.done && (
                  <Link
```

with:

```tsx
                {!step.done && visible.includes(step.href) && (
                  <Link
```

Leave the closing `)}` and everything else in that block untouched.

- [ ] **Step 3: Resolve and pass the list**

In `src/app/(dashboard)/setup/page.tsx`, add `visiblePages` to the rbac import so the line reads:

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { visiblePages } from "@/lib/rbac/page-permissions"
```

Then, immediately after the existing `const isAdmin = authorize(perms, "users:manage")`, add:

```ts
  const visible = visiblePages(perms)
```

and pass it in the JSX:

```tsx
    <SetupChecklist
      hasEmployees={employeeCount > 0}
      hasApiKey={apiKeyCount > 0}
      isAdmin={isAdmin}
      visible={visible}
    >
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all three silent or green.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/SetupChecklist.tsx "src/app/(dashboard)/setup/page.tsx"
git commit -m "fix(setup): hide the checklist links a role cannot follow"
```

---

### Task 3: The dashboard canvas

Two changes in one file because they are the same change: the component stops deciding from a role name and starts reading what the server resolved.

**Files:**
- Modify: `src/components/dashboard/DashboardCanvas.tsx:13` (import), `:52-64` (props), `:423-425`, `:448-449`, `:460`, `:466`, and the Library link near `:493`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `visiblePages` from Task 1.
- Produces: `DashboardCanvas` takes `visible: string[]` and `canManageShared: boolean`. The `userRole: string` prop is gone.

- [ ] **Step 1: Replace the props**

In `src/components/dashboard/DashboardCanvas.tsx`, delete the import on line 13:

```ts
import { ADMINISTRATOR } from "@/lib/rbac/presets"
```

Replace the component signature:

```tsx
export function DashboardCanvas({
  widgets,
  presets: initialPresets,
  activePresetId: initialActivePresetId,
  canManageShared,
  visible,
  sourceOptions = [],
}: {
  widgets: WidgetEntry[]
  presets: DashboardPreset[]
  activePresetId: string | null
  /**
   * Mirrors dashboard:manage_shared, the permission the preset routes check
   * themselves. This used to compare the role's name against "Administrator",
   * which disagreed with the server in both directions: a custom role holding
   * the permission was denied the control the API would have accepted, and a
   * role merely named Administrator was shown one the API refuses.
   */
  canManageShared: boolean
  /** Paths this role may open, resolved server-side. */
  visible: string[]
  sourceOptions?: SourceOption[]
}) {
```

- [ ] **Step 2: Drop the role-name derivation**

Replace:

```tsx
  const isAdmin = userRole === ADMINISTRATOR
  const canEditPreset = activePreset
    ? activePreset.scope === "PERSONAL" || isAdmin
    : false
```

with:

```tsx
  const canEditPreset = activePreset
    ? activePreset.scope === "PERSONAL" || canManageShared
    : false
```

Then replace the four remaining reads of `isAdmin`:

```tsx
                  canDelete={presets.length > 1 && (p.scope === "PERSONAL" || canManageShared)}
                  canRename={p.scope === "PERSONAL" || canManageShared}
```

```tsx
                onClick={() => canManageShared ? setAddMenuOpen((o) => !o) : createPreset("PERSONAL")}
```

```tsx
              {addMenuOpen && canManageShared && (
```

- [ ] **Step 3: Gate the Library link**

Replace:

```tsx
                  <Link
                    href="/dashboard/widgets"
                    className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <LayoutGrid className="size-3.5" />
                    Library
                  </Link>
```

with:

```tsx
                  {visible.includes("/dashboard/widgets") && (
                    <Link
                      href="/dashboard/widgets"
                      className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <LayoutGrid className="size-3.5" />
                      Library
                    </Link>
                  )}
```

- [ ] **Step 4: Resolve both answers on the server**

In `src/app/(dashboard)/dashboard/page.tsx`, delete the import of `VIEWER_ROLE`:

```ts
import { VIEWER_ROLE } from "@/lib/rbac/presets"
```

and add:

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { visiblePages } from "@/lib/rbac/page-permissions"
```

In the `prisma.user.findUnique` call, drop the now-unused role name from the select so it reads:

```ts
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { activePresetId: true },
    }),
```

After that `Promise.all` completes, add:

```ts
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const canManageShared = authorize(perms, "dashboard:manage_shared")
  const visible = visiblePages(perms)
```

Finally replace the render:

```tsx
    <DashboardCanvas
      widgets={widgets}
      presets={typedPresets}
      activePresetId={activePresetId}
      canManageShared={canManageShared}
      visible={visible}
      sourceOptions={sourceOptions}
    />
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all green. tsc is the real check here: it fails if any `isAdmin` or `userRole` read was missed.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DashboardCanvas.tsx "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "fix(dashboard): gate the preset controls on the permission the api checks"
```

---

### Task 4: The widget library

**Files:**
- Modify: `src/components/dashboard/WidgetLibrary.tsx:56-64` (props) and the header link near `:95`
- Modify: `src/app/(dashboard)/dashboard/widgets/page.tsx`

**Interfaces:**
- Consumes: `visiblePages` from Task 1.
- Produces: `WidgetLibrary` takes `visible: string[]` alongside `preset`, `allWidgets` and `widgetPreviews`.

- [ ] **Step 1: Add the prop**

In `src/components/dashboard/WidgetLibrary.tsx`, replace the signature:

```tsx
export function WidgetLibrary({
  preset,
  allWidgets,
  widgetPreviews,
  visible,
}: {
  preset: DashboardPreset
  allWidgets: WidgetDef[]
  widgetPreviews: Record<string, ReactNode>
  /**
   * Paths this role may open. Reaching this page needs dashboard:customize,
   * which does not imply dashboard:read, so the way back is not guaranteed.
   */
  visible: string[]
}) {
```

- [ ] **Step 2: Gate the back link and its separator**

Replace:

```tsx
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
            <span className="text-muted-foreground">-</span>
```

with:

```tsx
            {visible.includes("/dashboard") && (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to dashboard
                </Link>
                <span className="text-muted-foreground">-</span>
              </>
            )}
```

- [ ] **Step 3: Resolve and pass the list**

In `src/app/(dashboard)/dashboard/widgets/page.tsx`, add the imports:

```ts
import { getUserPermissions } from "@/lib/rbac/authorize"
import { visiblePages } from "@/lib/rbac/page-permissions"
```

After the existing `const activePreset = ...` line, add:

```ts
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const visible = visiblePages(perms)
```

and pass it:

```tsx
      <WidgetLibrary
        preset={preset}
        allWidgets={WIDGETS}
        widgetPreviews={widgetPreviews}
        visible={visible}
      />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/WidgetLibrary.tsx "src/app/(dashboard)/dashboard/widgets/page.tsx"
git commit -m "fix(dashboard): hide the widget library back link without dashboard read"
```

---

### Task 5: The report export buttons

**Files:**
- Modify: `src/components/reports/ReportToolbar.tsx:24` (props) and the two export controls
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Interfaces:**
- Produces: `ReportToolbar` takes `canExport: boolean` alongside `generatedAt` and the optional `filterQuery`.

- [ ] **Step 1: Add the prop**

In `src/components/reports/ReportToolbar.tsx`, replace the signature:

```tsx
export function ReportToolbar({
  generatedAt,
  filterQuery = "",
  canExport,
}: {
  generatedAt: string
  filterQuery?: string
  /**
   * Mirrors reports:export, which /api/reports/export enforces. Without it
   * both controls below lead to a 403, so neither is offered. The generated
   * timestamp stays: it is information, not an action.
   */
  canExport: boolean
}) {
```

- [ ] **Step 2: Gate both controls**

Wrap the CSV dropdown and the PDF link in a single fragment. Replace everything from `<div className="relative">` through the closing `</a>` of the PDF link with:

```tsx
      {canExport && (
        <>
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              <Download className="size-3.5" />
              CSV
              <ChevronDown className="size-3" />
            </Button>
            {open && (
              <>
                <button
                  type="button"
                  aria-label="Close export menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-md">
                  {CSV_SECTIONS.map((s) => (
                    <a
                      key={s.key}
                      href={`/api/reports/export?section=${s.key}${suffix}`}
                      download
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
          <a
            href={`/api/reports/export?format=pdf&section=all${suffix}`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Printer className="size-3.5" />
            PDF
          </a>
        </>
      )}
```

- [ ] **Step 3: Resolve the permission**

In `src/app/(dashboard)/reports/page.tsx`, add the import:

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
```

After `const companyId = session!.user.companyId`, add:

```ts
  const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
  const canExport = authorize(perms, "reports:export")
```

and pass it:

```tsx
        <ReportToolbar generatedAt={data.generatedAt} filterQuery={filterQuery} canExport={canExport} />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/ReportToolbar.tsx "src/app/(dashboard)/reports/page.tsx"
git commit -m "fix(reports): offer the export controls only with reports export"
```

---

### Task 6: The evidence download

The route this links to is one of the two GET-only routes missing from `ROUTE_PERMISSIONS`, so the link test in Task 7 cannot see it as gated until it is declared. Declaring it is safe: `src/app/api/register/[id]/evidence/route.ts:7` already calls `requirePermission("register:evidence")` and never calls `requireAuth`, which is what the two existing assertions in `route-coverage.test.ts` check.

**Files:**
- Modify: `src/lib/rbac/route-permissions.ts` (one entry)
- Modify: `src/components/register/ExposureRegister.tsx:22` (props) and the download link near `:145`
- Modify: `src/app/(dashboard)/register/page.tsx`

**Interfaces:**
- Produces: `ExposureRegister` takes `canDownloadEvidence: boolean` alongside `initial` and `isAdmin`. `isAdmin` stays: it mirrors `register:manage` and answers a different question.

- [ ] **Step 1: Declare the route**

In `src/lib/rbac/route-permissions.ts`, add this line directly below the existing `"register/[id]": "register:manage",`:

```ts
  "register/[id]/evidence": "register:evidence",
```

- [ ] **Step 2: Run the route coverage test to confirm the declaration holds**

Run: `npx vitest run src/lib/rbac/route-coverage.test.ts`
Expected: PASS. A failure here would mean the route falls back to `requireAuth` or does not enforce the permission, in which case stop and report rather than editing the route.

- [ ] **Step 3: Add the prop**

In `src/components/register/ExposureRegister.tsx`, replace the signature:

```tsx
export function ExposureRegister({
  initial,
  isAdmin,
  canDownloadEvidence,
}: {
  initial: RegisterRow[]
  isAdmin: boolean
  /**
   * Mirrors register:evidence, which the evidence route enforces. Distinct
   * from isAdmin, which is register:manage: this link sits outside that block
   * and was offered to every reader of the register.
   */
  canDownloadEvidence: boolean
}) {
```

- [ ] **Step 4: Gate the download link**

Replace:

```tsx
                  <a
                    href={`/api/register/${r.id}/evidence`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                    title="Download evidence pack (CSV)"
                  >
                    <Download className="size-3.5" />
                  </a>
```

with:

```tsx
                  {canDownloadEvidence && (
                    <a
                      href={`/api/register/${r.id}/evidence`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                      title="Download evidence pack (CSV)"
                    >
                      <Download className="size-3.5" />
                    </a>
                  )}
```

- [ ] **Step 5: Resolve the permission**

In `src/app/(dashboard)/register/page.tsx`, after the existing `const isAdmin = authorize(perms, "register:manage")`, add:

```ts
  const canDownloadEvidence = authorize(perms, "register:evidence")
```

and pass it:

```tsx
      <ExposureRegister
        initial={entries}
        isAdmin={isAdmin}
        canDownloadEvidence={canDownloadEvidence}
      />
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rbac/route-permissions.ts src/components/register/ExposureRegister.tsx "src/app/(dashboard)/register/page.tsx"
git commit -m "fix(register): offer the evidence download only with register evidence"
```

---

### Task 7: The link coverage test

Written last on purpose. It is a net, not a driver: every site it guards is already correct, so it goes green immediately. Step 3 is therefore not optional, it is the only thing that proves the net has a hole-free mesh.

**Files:**
- Create: `src/lib/rbac/link-coverage.test.ts`

**Interfaces:**
- Consumes: `PAGE_PERMISSIONS` from `./page-permissions`, `ROUTE_PERMISSIONS` from `./route-permissions`.

- [ ] **Step 1: Write the test**

Create `src/lib/rbac/link-coverage.test.ts`:

```ts
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

// Any quoted or backticked literal that starts with a slash.
const LITERAL = /["'`](\/[^"'`]*)["'`]/g

// "${...}" in a template literal and "[param]" in a route key both stand for
// one variable segment. Normalising both is what lets them compare.
function normalise(path: string): string {
  return path.replace(/\$\{[^}]*\}/g, "*").replace(/\[[^\]]*\]/g, "*")
}

// Only literals on a line that mentions href count. That excludes redirect()
// and router.push(), which are not affordances the reader can decline, and it
// still catches a path held in an object field rather than an attribute, which
// is how SetupChecklist writes its three.
function linkedPaths(source: string): string[] {
  const found: string[] = []
  for (const line of source.split("\n")) {
    if (!line.includes("href")) continue
    for (const match of line.matchAll(LITERAL)) found.push(match[1].split(/[?#]/)[0])
  }
  return found
}

const GATED_PAGES = new Set(
  Object.entries(PAGE_PERMISSIONS)
    .filter(([, permission]) => permission !== "AUTH_ONLY")
    .map(([path]) => path)
)

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
      if (!linkedPaths(source).some((path) => GATED_PAGES.has(path))) continue
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

  it("every declared API link names the permission its route actually enforces", () => {
    for (const [file, permission] of Object.entries(API_LINK_PERMISSIONS)) {
      const enforced = apiLinks(readFileSync(join(SRC, file), "utf8")).map((path) =>
        GATED_API.get(path)
      )
      expect(enforced, file).toContain(permission)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `npx vitest run src/lib/rbac/link-coverage.test.ts`
Expected: PASS, three tests green.

- [ ] **Step 3: Prove it can fail**

A guard only ever seen succeeding proves nothing. Break each assertion once and confirm it reports the right file, then restore.

For the first assertion, in `src/components/dashboard/SetupChecklist.tsx` temporarily change `visible.includes(step.href)` to `true`.
Run: `npx vitest run src/lib/rbac/link-coverage.test.ts`
Expected: FAIL naming `components/dashboard/SetupChecklist.tsx`. Restore the line with `git checkout -- src/components/dashboard/SetupChecklist.tsx`.

For the second, temporarily delete the `components/reports/ReportToolbar.tsx` entry from `API_LINK_PERMISSIONS`.
Run: `npx vitest run src/lib/rbac/link-coverage.test.ts`
Expected: FAIL naming `components/reports/ReportToolbar.tsx` on both the second and third assertions. Restore the entry.

- [ ] **Step 4: Run the full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: all green, 241 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac/link-coverage.test.ts
git commit -m "test(rbac): fail the build on a link to a page the role cannot open"
```

---

### Task 8: The behaviour test

The static test proves the wiring exists. Only Playwright proves the button is gone. The fixture to use is `member@gardik.local`, the Viewer: it holds every `:read` permission and none of the actions, so it reaches all three pages and must find no control leading to a refusal.

**Files:**
- Modify: `e2e/seed.ts` (one register entry, near the end of `main`, before the passkey fixture)
- Modify: `e2e/rbac.spec.ts` (append one test)

- [ ] **Step 1: Seed a register entry**

The register is empty in the e2e fixture today, so an assertion that the download link is absent would pass without the code being right. Add this in `e2e/seed.ts`, immediately after the `narrow` user's `await setPassword(narrow.id, NARROW_PASSWORD)` line:

```ts
  // One register row so the rbac spec can assert on the evidence download.
  // Without a row the control is absent for everybody and the assertion would
  // pass while proving nothing.
  await prisma.exposureRegisterEntry.upsert({
    where: { id: "e2e-register-entry" },
    update: {},
    create: {
      id: "e2e-register-entry",
      companyId: company.id,
      title: "E2E fixture exposure",
      detectedAt: new Date("2026-01-15T00:00:00Z"),
      status: "ASSESSING",
      affectedCount: 3,
      dataCategories: ["email", "password"],
    },
  })
```

- [ ] **Step 2: Write the test**

Append to `e2e/rbac.spec.ts`:

```ts
// The other half of the rule the test above covers. That one proves the guard
// refuses the target; this one proves the interface stops offering the way in.
// A Viewer holds every ":read" permission and none of the actions, so it opens
// all three of these pages legitimately and must find no control on them that
// leads to a refusal. Each assertion is paired with the admin case, because a
// selector that matches nothing passes whether or not the code is right.
test("a read-only role is offered no control it cannot use", async ({ page }) => {
  await login(page, MEMBER)

  // reports:read without reports:export.
  await page.goto("/reports")
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()
  await expect(page.getByRole("button", { name: "CSV" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "PDF" })).toHaveCount(0)

  // register:read without register:evidence.
  await page.goto("/register")
  await expect(page.getByText("E2E fixture exposure")).toBeVisible()
  await expect(page.getByTitle("Download evidence pack (CSV)")).toHaveCount(0)

  // dashboard:read without dashboard:customize.
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Customize" }).click()
  await expect(page.getByRole("link", { name: "Library" })).toHaveCount(0)
})

test("an admin is offered the same controls, so the selectors above mean something", async ({
  page,
}) => {
  await login(page, ADMIN)

  await page.goto("/reports")
  await expect(page.getByRole("button", { name: "CSV" })).toBeVisible()
  await expect(page.getByRole("link", { name: "PDF" })).toBeVisible()

  await page.goto("/register")
  await expect(page.getByTitle("Download evidence pack (CSV)").first()).toBeVisible()

  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Customize" }).click()
  await expect(page.getByRole("link", { name: "Library" })).toBeVisible()
})
```

- [ ] **Step 3: Run the spec**

Run: `npm run test:e2e -- e2e/rbac.spec.ts`
Expected: every test in the file passes. If the admin test fails on the register row, the seed did not re-run: re-seed and retry.

- [ ] **Step 4: Commit**

```bash
git add e2e/seed.ts e2e/rbac.spec.ts
git commit -m "test(e2e): assert a read-only role is offered no unusable control"
```

---

## Manual check

With the implementation complete, confirm it against the development database, where the role `Test Minimal` (`dashboard:read` only) already exists.

```bash
cd /home/white/GitHub/Gardik
export $(grep -m1 '^DATABASE_URL=' .env.local | xargs)
psql "$DATABASE_URL" -c "update \"User\" set \"roleId\"='role_testmin_cmqkpwivr0000c2snlh7zry6i' where email='admin@gardik.local';"
npm run dev
```

Expected, with no re-login needed since there is no session cookie cache:

- `/dashboard` opens. Customize shows no Library button.
- `/setup`, if reached, keeps its three steps and their descriptions and shows none of their links.
- `/employees` still answers "Not available to your role", and its HTML still contains no employee address.

Restore the admin role afterwards:

```bash
psql "$DATABASE_URL" -c "update \"User\" set \"roleId\"='role_admin_cmqkpwivr0000c2snlh7zry6i' where email='admin@gardik.local';"
```

## Out of scope, tracked separately

- The post-login landing. `(auth)/login/page.tsx` and `app/page.tsx` both send the user to `/dashboard`, gated by `dashboard:read`, so a role without it meets a refusal as its first screen. A redirect to recompute, not an affordance to hide.
- `route-coverage.test.ts` inspects mutating handlers only, so a GET-only route can still ship unregistered. Task 6 declares `register/[id]/evidence` because this feature needs it; `audit` remains undeclared and the assertion remains blind to both.
