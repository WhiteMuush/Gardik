# RBAC Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc `ADMIN`/`VIEWER` enum + scattered `isAdmin` checks with a permission-based authorization core: a code-defined permission catalog, per-company `Role` records built from it (seeded presets), a single `authorize`/`requirePermission` guard, and a route->permission registry with a build-failing coverage test.

**Architecture:** Permissions are `domain:action` string constants (fixed vocabulary in code). A per-company `Role` row holds a subset of them; `User.roleId` points at one. A central `requirePermission(perm)` resolves the caller's role permissions from the DB and allows or returns 403. A registry maps every mutating API route to the permission it needs; a test fails the build if a mutating route is missing. This plan changes authorization plumbing only; it does not add SSO, custom-role management UI, or break-glass (later plans).

**Tech Stack:** Next.js 15 (App Router), better-auth 1.6.25, Prisma 7 + PostgreSQL, Vitest 4, TypeScript.

## Global Constraints

- Build on branch `develop`. Do not merge to `main`.
- Node 22 is pinned (`engine-strict=true`). The dev shell may run Node 24; `npm run`, `npx tsc`, `npx vitest`, `npx prisma` all work under it. Only `npm install` is blocked; if a task installs a package, run `npm install <pkg> --engine-strict=false`. This plan installs nothing.
- Local DB runs via `npm run db:up` (auto-detects Docker or Podman; container `datashield-db` on `localhost:5432`). Env is loaded with `npx dotenv -e .env.local -- <cmd>` for anything touching the DB.
- After any `prisma migrate dev`, run `npx prisma generate` explicitly; `migrate dev` does not reliably regenerate the client in this repo.
- No `console.log(` anywhere under `src/` (pre-commit blocks it). Use `console.warn`/`console.error` if needed.
- Never use the em dash character (Unicode U+2014) anywhere. Use a comma, colon, or parentheses instead.
- Commit messages follow Conventional Commits and must contain no AI-attribution trailers; the repo commit-msg hook enforces both.
- Tests: unit tests mock Prisma; DB-backed integration tests run in-process against the real `auth`/`prisma` with `datashield-db` up (pattern: build a `Request`, call `auth.handler`, or call the route function directly). Run integration with `npx dotenv -e .env.local -- npx vitest run <file>`.
- Existing guard lives in `src/lib/apiAuth.ts` (`requireAuth`, `requireAdmin`, `forbidden()`, `enforce2fa`). Extend it; keep `requireAuth` and `enforce2fa` behavior intact.

---

### Task 1: Permission catalog

**Files:**
- Create: `src/lib/rbac/permissions.ts`
- Test: `src/lib/rbac/permissions.test.ts`

**Interfaces:**
- Produces: `PERMISSIONS: readonly Permission[]`, `type Permission` (string union), `PERMISSION_SET: ReadonlySet<Permission>`, `isPermission(value: string): value is Permission`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rbac/permissions.test.ts
import { describe, it, expect } from "vitest"
import { PERMISSIONS, PERMISSION_SET, isPermission } from "./permissions"

describe("permission catalog", () => {
  it("contains the core SOC and admin permissions", () => {
    for (const p of [
      "alerts:read", "alerts:assign", "alerts:status", "alerts:comment",
      "alerts:close", "alerts:remediate",
      "roles:manage", "users:manage", "sso:config", "sso:role_map",
      "policy:manage", "audit:read",
    ]) {
      expect(PERMISSION_SET.has(p as never)).toBe(true)
    }
  })

  it("has no duplicates", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it("narrows unknown strings", () => {
    expect(isPermission("alerts:read")).toBe(true)
    expect(isPermission("alerts:launch_nukes")).toBe(false)
  })

  it("is frozen", () => {
    expect(Object.isFrozen(PERMISSIONS)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rbac/permissions.test.ts`
Expected: FAIL, cannot find module `./permissions`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/rbac/permissions.ts
// Fixed vocabulary of authorization permissions, "domain:action". A Role holds
// a validated subset of these. Namespaced so a domain can be subdivided later
// without breaking a role that held the broader grant. Adding a feature means
// adding its permissions here.
export const PERMISSIONS = Object.freeze([
  // Alerts (SOC core)
  "alerts:read", "alerts:assign", "alerts:status", "alerts:comment",
  "alerts:close", "alerts:remediate",
  // Employees (monitored subjects)
  "employees:read", "employees:manage", "employees:scan",
  // Exposure register
  "register:read", "register:manage", "register:evidence",
  // Dashboard
  "dashboard:read", "dashboard:customize", "dashboard:manage_shared",
  // Reports
  "reports:read", "reports:export", "reports:schedule",
  // Directory connectors
  "connectors:read", "connectors:manage", "connectors:sync",
  // Data API
  "api_credentials:read", "api_credentials:manage",
  // Notifications
  "notifications:read", "notifications:manage",
  // Security policy
  "policy:read", "policy:manage",
  // Identity / IdP
  "sso:read", "sso:config", "sso:role_map",
  // RBAC
  "users:read", "users:manage", "roles:read", "roles:manage",
  // Audit
  "audit:read",
] as const)

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_SET: ReadonlySet<Permission> = new Set(PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value as Permission)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rbac/permissions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac/permissions.ts src/lib/rbac/permissions.test.ts
git commit -m "feat(rbac): add the permission catalog"
```

---

### Task 2: Role presets (code)

**Files:**
- Create: `src/lib/rbac/presets.ts`
- Test: `src/lib/rbac/presets.test.ts`

**Interfaces:**
- Consumes: `PERMISSIONS`, `Permission`, `PERMISSION_SET` from Task 1.
- Produces: `PRESETS: ReadonlyArray<{ name: string; description: string; permissions: Permission[]; isSystem: boolean; isAssignable: boolean }>`, and the constant names `ADMINISTRATOR = "Administrator"`, `VIEWER_ROLE = "Viewer"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rbac/presets.test.ts
import { describe, it, expect } from "vitest"
import { PRESETS, ADMINISTRATOR, VIEWER_ROLE } from "./presets"
import { PERMISSIONS, PERMISSION_SET } from "./permissions"

describe("role presets", () => {
  it("Administrator holds every permission and is immutable", () => {
    const admin = PRESETS.find((p) => p.name === ADMINISTRATOR)!
    expect(admin.isSystem).toBe(true)
    expect(new Set(admin.permissions).size).toBe(PERMISSIONS.length)
  })

  it("Viewer holds only :read permissions", () => {
    const viewer = PRESETS.find((p) => p.name === VIEWER_ROLE)!
    expect(viewer.permissions.every((p) => p.endsWith(":read"))).toBe(true)
  })

  it("every preset permission is in the catalog", () => {
    for (const preset of PRESETS) {
      for (const p of preset.permissions) expect(PERMISSION_SET.has(p)).toBe(true)
    }
  })

  it("Security Manager cannot manage roles or the group->role map", () => {
    const sm = PRESETS.find((p) => p.name === "Security Manager")!
    expect(sm.permissions).not.toContain("roles:manage")
    expect(sm.permissions).not.toContain("sso:role_map")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rbac/presets.test.ts`
Expected: FAIL, cannot find module `./presets`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/rbac/presets.ts
import { PERMISSIONS, type Permission } from "./permissions"

export const ADMINISTRATOR = "Administrator"
export const VIEWER_ROLE = "Viewer"

const READ_ONLY = PERMISSIONS.filter((p) => p.endsWith(":read")) as Permission[]

export const PRESETS = [
  {
    name: ADMINISTRATOR,
    description: "Full access. Built-in, cannot be edited or deleted.",
    permissions: [...PERMISSIONS] as Permission[],
    isSystem: true,
    isAssignable: true,
  },
  {
    name: "Security Manager",
    description: "Manages policy, connectors, SSO config, users and reports. Cannot manage roles or the group->role map.",
    permissions: [
      "policy:read", "policy:manage",
      "connectors:read", "connectors:manage", "connectors:sync",
      "sso:read", "sso:config",
      "users:read", "users:manage", "roles:read",
      "reports:read", "reports:export", "reports:schedule",
      "alerts:read", "employees:read", "register:read", "dashboard:read",
      "api_credentials:read", "notifications:read", "audit:read",
    ] as Permission[],
    isSystem: false,
    isAssignable: true,
  },
  {
    name: "SOC Analyst",
    description: "Operates on alerts, runs scans, manages the exposure register.",
    permissions: [
      "alerts:read", "alerts:assign", "alerts:status", "alerts:comment",
      "alerts:close", "alerts:remediate",
      "employees:read", "employees:scan",
      "register:read", "register:manage", "register:evidence",
      "reports:read", "reports:export",
      "dashboard:read", "dashboard:customize",
      "connectors:read", "notifications:read", "api_credentials:read",
      "policy:read", "sso:read", "users:read", "roles:read", "audit:read",
    ] as Permission[],
    isSystem: false,
    isAssignable: true,
  },
  {
    name: VIEWER_ROLE,
    description: "Read-only across the workspace.",
    permissions: READ_ONLY,
    isSystem: false,
    isAssignable: true,
  },
] as const

export type Preset = (typeof PRESETS)[number]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rbac/presets.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac/presets.ts src/lib/rbac/presets.test.ts
git commit -m "feat(rbac): define the seeded role presets"
```

---

### Task 3: Schema and migration (Role table, User.roleId, backfill)

**Files:**
- Modify: `prisma/schema.prisma` (User model, add Role model, add Company relation, remove `Role` enum)
- Create: `prisma/migrations/<timestamp>_rbac_roles/migration.sql` (generated, then hand-edited for backfill)
- Create: `src/lib/rbac/seed-roles.ts`
- Test: `src/lib/rbac/seed-roles.test.ts`
- Modify: `src/lib/auth/server.ts:136-139` (additionalFields: replace `role` with `roleId`)

**Interfaces:**
- Consumes: `PRESETS`, `ADMINISTRATOR`, `VIEWER_ROLE` from Task 2.
- Produces: `seedPresetsForCompany(tx, companyId): Promise<void>`, `resolvePresetRoleId(tx, companyId, name): Promise<string>`.

- [ ] **Step 1: Edit the Prisma schema**

In `prisma/schema.prisma`, in `model User`, replace the line `role Role @default(VIEWER)` with `roleId String?`, and add to the User relations block:

```prisma
  role             Role?             @relation(fields: [roleId], references: [id], onDelete: SetNull)
```

Add the new model after `model TwoFactor` (and before `enum AuthMethod`):

```prisma
model Role {
  id           String   @id @default(cuid())
  companyId    String
  name         String
  description  String   @default("")
  permissions  String[]
  isSystem     Boolean  @default(false)
  isAssignable Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  users   User[]

  @@unique([companyId, name])
  @@index([companyId])
}
```

Add `roles Role[]` to the `Company` model relations. Remove the `enum Role { ADMIN VIEWER }` block (the model now owns the name `Role`).

- [ ] **Step 2: Create the migration (schema only), then verify it fails to preserve data**

Run: `npx dotenv -e .env.local -- npx prisma migrate dev --name rbac_roles --create-only`
This writes `prisma/migrations/<timestamp>_rbac_roles/migration.sql` without applying it. Open that file. Prisma will have generated `DROP` of the old `role` column and the enum, and creation of `Role` + `roleId`. This drops data. Replace the file body with the ordered, data-preserving SQL in Step 3.

- [ ] **Step 3: Replace the migration SQL with a data-preserving version**

```sql
-- Create Role table
CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "permissions" TEXT[],
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isAssignable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable roleId to User
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Seed the two presets this migration needs (Administrator, Viewer) for every
-- existing company, then backfill roleId from the old enum. Other presets
-- (Security Manager, SOC Analyst) are seeded by the app on company creation and
-- can be added later; existing users only ever held ADMIN or VIEWER.
INSERT INTO "Role" ("id", "companyId", "name", "description", "permissions", "isSystem", "isAssignable", "createdAt", "updatedAt")
SELECT 'role_admin_' || c."id", c."id", 'Administrator', 'Full access. Built-in, cannot be edited or deleted.',
       ARRAY[]::TEXT[], true, true, now(), now()
FROM "Company" c;

INSERT INTO "Role" ("id", "companyId", "name", "description", "permissions", "isSystem", "isAssignable", "createdAt", "updatedAt")
SELECT 'role_viewer_' || c."id", c."id", 'Viewer', 'Read-only across the workspace.',
       ARRAY[]::TEXT[], false, true, now(), now()
FROM "Company" c;

UPDATE "User" u SET "roleId" = 'role_admin_' || u."companyId" WHERE u."role" = 'ADMIN';
UPDATE "User" u SET "roleId" = 'role_viewer_' || u."companyId" WHERE u."role" = 'VIEWER';

-- Drop the old enum column and type
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- FK for User.roleId
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Note: the seeded preset rows above use empty `permissions` on purpose; Step 6's `seed-roles` backfills the correct permission arrays for these presets (and adds the other two) idempotently. The migration only needs the rows to exist so `roleId` can point at them.

- [ ] **Step 4: Apply the migration**

Run: `npx dotenv -e .env.local -- npx prisma migrate dev`
Expected: `The following migration(s) have been applied` and `Your database is now in sync`.
Then run: `npx prisma generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 5: Update better-auth additional fields**

In `src/lib/auth/server.ts`, change the `additionalFields` block (currently exposing `role`) to:

```ts
    additionalFields: {
      roleId: { type: "string", input: false, required: false },
      companyId: { type: "string", input: false },
    },
```

- [ ] **Step 6: Write the seed helper with a failing integration test**

```ts
// src/lib/rbac/seed-roles.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany } from "./seed-roles"
import { PRESETS } from "./presets"

let companyId: string

beforeAll(async () => {
  const c = await prisma.company.create({
    data: { name: "Seed Test Co", domain: `seed-${Date.now()}.test` },
  })
  companyId = c.id
})

describe("seedPresetsForCompany (real DB)", () => {
  it("creates every preset once and is idempotent", async () => {
    await seedPresetsForCompany(prisma, companyId)
    await seedPresetsForCompany(prisma, companyId)
    const roles = await prisma.role.findMany({ where: { companyId } })
    expect(roles.length).toBe(PRESETS.length)
    const admin = roles.find((r) => r.name === "Administrator")!
    expect(admin.isSystem).toBe(true)
    expect(admin.permissions.length).toBeGreaterThan(0)
  })
})
```

Note: check the `company.create` required fields against `prisma/schema.prisma` (`model Company`) before running; add any other non-null fields the schema requires.

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx dotenv -e .env.local -- npx vitest run src/lib/rbac/seed-roles.test.ts`
Expected: FAIL, cannot find module `./seed-roles`.

- [ ] **Step 8: Implement the seed helper**

```ts
// src/lib/rbac/seed-roles.ts
import type { PrismaClient } from "@prisma/client"
import { PRESETS } from "./presets"

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

// Idempotently ensure every preset role exists for a company with the correct
// permissions. Safe to call on company creation and to re-run (upsert by the
// unique (companyId, name)). Used by the migration follow-up and company setup.
export async function seedPresetsForCompany(db: Db, companyId: string): Promise<void> {
  for (const preset of PRESETS) {
    await db.role.upsert({
      where: { companyId_name: { companyId, name: preset.name } },
      update: {
        description: preset.description,
        permissions: [...preset.permissions],
        isSystem: preset.isSystem,
        isAssignable: preset.isAssignable,
      },
      create: {
        companyId,
        name: preset.name,
        description: preset.description,
        permissions: [...preset.permissions],
        isSystem: preset.isSystem,
        isAssignable: preset.isAssignable,
      },
    })
  }
}

export async function resolvePresetRoleId(db: Db, companyId: string, name: string): Promise<string> {
  const role = await db.role.findUniqueOrThrow({
    where: { companyId_name: { companyId, name } },
  })
  return role.id
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx dotenv -e .env.local -- npx vitest run src/lib/rbac/seed-roles.test.ts`
Expected: PASS.

- [ ] **Step 10: Backfill preset permissions on the running DB and typecheck**

Run: `npx dotenv -e .env.local -- npx tsx -e "import {PrismaClient} from '@prisma/client'; import {PrismaPg} from '@prisma/adapter-pg'; import {seedPresetsForCompany} from './src/lib/rbac/seed-roles'; const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}); const cs=await p.company.findMany(); for(const c of cs) await seedPresetsForCompany(p,c.id); await p.\$disconnect(); console.warn('backfilled',cs.length)"`
Expected: `backfilled <n>`.
Then run: `npx tsc --noEmit`
Expected: errors ONLY at the `session.user.role` call sites migrated in Task 6 (they still reference the removed field). That is expected here; Task 6 fixes them. If any other errors appear, resolve them before continuing.

- [ ] **Step 11: Wire preset seeding into company creation**

Find where a `Company` is created in app code (grep `prisma.company.create`; expected in `src/lib/register.ts` and/or `prisma/seed.ts`). In each place a NEW company is created for real use, call `await seedPresetsForCompany(prisma, company.id)` right after. Show the register.ts change:

```ts
// after: const company = await prisma.company.create({ ... })
await seedPresetsForCompany(prisma, company.id)
```

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/rbac/seed-roles.ts src/lib/rbac/seed-roles.test.ts src/lib/auth/server.ts src/lib/register.ts
git commit -m "feat(rbac): replace the role enum with per-company role records"
```

---

### Task 4: authorize and requirePermission guard

**Files:**
- Create: `src/lib/rbac/authorize.ts`
- Test: `src/lib/rbac/authorize.test.ts`
- Modify: `src/lib/apiAuth.ts` (add `requirePermission`, keep `requireAuth`)

**Interfaces:**
- Consumes: `Permission` from Task 1; `prisma`; `getSession`; `enforce2fa`, `Guard`, `unauthorized` from `apiAuth`.
- Produces: `authorize(perms: ReadonlySet<string>, needed: Permission): boolean`; `getUserPermissions(db, roleId: string | null): Promise<Set<string>>`; `requirePermission(perm: Permission): Promise<Guard>` exported from `apiAuth`.

- [ ] **Step 1: Write the failing unit test for authorize + getUserPermissions**

```ts
// src/lib/rbac/authorize.test.ts
import { describe, it, expect, vi } from "vitest"
import { authorize, getUserPermissions } from "./authorize"

describe("authorize", () => {
  it("allows only when the permission is present", () => {
    const perms = new Set(["alerts:read", "alerts:assign"])
    expect(authorize(perms, "alerts:assign")).toBe(true)
    expect(authorize(perms, "roles:manage")).toBe(false)
  })
})

describe("getUserPermissions", () => {
  it("returns an empty set for a user with no role (no-access pending)", async () => {
    const db = { role: { findUnique: vi.fn() } } as never
    expect((await getUserPermissions(db, null)).size).toBe(0)
  })

  it("returns the role's permissions", async () => {
    const db = {
      role: { findUnique: vi.fn().mockResolvedValue({ permissions: ["alerts:read"] }) },
    } as never
    const perms = await getUserPermissions(db, "role1")
    expect(perms.has("alerts:read")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rbac/authorize.test.ts`
Expected: FAIL, cannot find module `./authorize`.

- [ ] **Step 3: Implement authorize + getUserPermissions**

```ts
// src/lib/rbac/authorize.ts
import type { PrismaClient } from "@prisma/client"
import type { Permission } from "./permissions"

type Db = Pick<PrismaClient, "role">

export function authorize(perms: ReadonlySet<string>, needed: Permission): boolean {
  return perms.has(needed)
}

// A null roleId means no-access pending: zero permissions. Otherwise load the
// role's permission list. Kept as its own function so callers can memoize per
// request if needed.
export async function getUserPermissions(db: Db, roleId: string | null): Promise<Set<string>> {
  if (!roleId) return new Set()
  const role = await db.role.findUnique({ where: { id: roleId }, select: { permissions: true } })
  return new Set(role?.permissions ?? [])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rbac/authorize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add requirePermission to apiAuth**

In `src/lib/apiAuth.ts`, change the `forbidden` helper message and add `requirePermission`. Replace the `forbidden` line and append the new function:

```ts
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })
```

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import type { Permission } from "@/lib/rbac/permissions"
import { prisma } from "@/lib/prisma"

export async function requirePermission(perm: Permission): Promise<Guard> {
  const session = await getSession()
  if (!session) return { session: null, error: unauthorized() }
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  if (!authorize(perms, perm)) return { session: null, error: forbidden() }
  const gate = await enforce2fa(session)
  if (gate) return { session: null, error: gate }
  return { session, error: null }
}
```

(`prisma` is already imported in `apiAuth.ts`; do not import it twice. `session.user.roleId` is the additional field from Task 3.)

- [ ] **Step 6: Write a failing integration test for requirePermission**

```ts
// src/lib/rbac/require-permission.itest.ts
import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"
import { seedPresetsForCompany, resolvePresetRoleId } from "./seed-roles"

// Uses the seeded admin from `npx tsx prisma/seed.ts`. Assigns it the Viewer
// preset, then asserts a Viewer lacks policy:manage but holds policy:read.
describe("requirePermission (real DB, in-process)", () => {
  it("Viewer is denied policy:manage but allowed policy:read", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await seedPresetsForCompany(prisma, admin.companyId)
    const viewerId = await resolvePresetRoleId(prisma, admin.companyId, "Viewer")
    await prisma.user.update({ where: { id: admin.id }, data: { roleId: viewerId } })

    const perms = await prisma.role.findUniqueOrThrow({ where: { id: viewerId } })
    expect(perms.permissions).toContain("policy:read")
    expect(perms.permissions).not.toContain("policy:manage")

    // Restore Administrator so other suites keep working.
    const adminRole = await resolvePresetRoleId(prisma, admin.companyId, "Administrator")
    await prisma.user.update({ where: { id: admin.id }, data: { roleId: adminRole } })
  })
})
```

- [ ] **Step 7: Run the integration test**

Run: `npx dotenv -e .env.local -- npx vitest run src/lib/rbac/require-permission.itest.ts`
Expected: PASS. (Ensure `npm run db:up` and `npx dotenv -e .env.local -- npx tsx prisma/seed.ts` have been run once.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/rbac/authorize.ts src/lib/rbac/authorize.test.ts src/lib/rbac/require-permission.itest.ts src/lib/apiAuth.ts
git commit -m "feat(rbac): add the authorize and requirePermission guard"
```

---

### Task 5: Route to permission registry + coverage test

**Files:**
- Create: `src/lib/rbac/route-permissions.ts`
- Test: `src/lib/rbac/route-coverage.test.ts`

**Interfaces:**
- Consumes: `Permission` from Task 1.
- Produces: `ROUTE_PERMISSIONS: Record<string, Permission | "PUBLIC" | "AUTH_ONLY">` keyed by the route path relative to `src/app/api` (for example `"company/auth-policy"`).

- [ ] **Step 1: Write the failing coverage test**

```ts
// src/lib/rbac/route-coverage.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rbac/route-coverage.test.ts`
Expected: FAIL, cannot find module `./route-permissions`.

- [ ] **Step 3: Implement the registry**

First enumerate the mutating routes to fill the map:

Run: `grep -rlE "export async function (POST|PATCH|PUT|DELETE)" src/app/api --include=route.ts | sed 's#src/app/api/##;s#/route.ts##' | sort`

Create `src/lib/rbac/route-permissions.ts` mapping each key from that output to its permission. `PUBLIC` = no auth (health, cron with its own secret, SCIM with its own token, the better-auth catch-all); `AUTH_ONLY` = any authenticated user (dashboard personal config). Fill from this baseline and reconcile with the grep output:

```ts
// src/lib/rbac/route-permissions.ts
import type { Permission } from "./permissions"

// Every mutating API route must appear here. The coverage test fails the build
// if a mutating route is missing. "PUBLIC" = no session (own auth or none).
// "AUTH_ONLY" = any authenticated user, no specific permission.
export const ROUTE_PERMISSIONS: Record<string, Permission | "PUBLIC" | "AUTH_ONLY"> = {
  "auth/[...all]": "PUBLIC",
  "health": "PUBLIC",
  "cron": "PUBLIC",
  "integrations/siem/[companyId]": "PUBLIC",
  "scim/[connectionId]/Users": "PUBLIC",
  "scim/[connectionId]/Users/[scimId]": "PUBLIC",

  "alerts/[id]": "alerts:status",
  "alerts/[id]/remediate": "alerts:remediate",
  "company": "policy:manage",
  "company/auth-policy": "policy:manage",
  "credentials": "api_credentials:manage",
  "credentials/[id]": "api_credentials:manage",
  "dashboard/config": "AUTH_ONLY",
  "dashboard/presets": "AUTH_ONLY",
  "dashboard/presets/[id]": "AUTH_ONLY",
  "dashboard/presets/[id]/activate": "AUTH_ONLY",
  "directory": "connectors:manage",
  "directory/[id]": "connectors:manage",
  "directory/[id]/sync": "connectors:sync",
  "directory/[id]/test": "connectors:sync",
  "employees/scan": "employees:scan",
  "register": "register:manage",
  "register/[id]": "register:manage",
  "register/[id]/evidence": "register:evidence",
  "reports/schedules": "reports:schedule",
  "reports/schedules/[id]": "reports:schedule",
  "webhooks": "notifications:manage",
  "webhooks/[id]": "notifications:manage",
  "webhooks/[id]/test": "notifications:manage",
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rbac/route-coverage.test.ts`
Expected: PASS. If it lists missing routes, add each to the map with the right permission (cross-check against the grep output). If it lists routes that no longer exist, remove those keys.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac/route-permissions.ts src/lib/rbac/route-coverage.test.ts
git commit -m "feat(rbac): add the route->permission registry and coverage test"
```

---

### Task 6: Migrate call sites from role checks to permissions

**Files (modify):** the sites below. This removes every remaining reference to `session.user.role` and `requireAdmin`.

**Interfaces:**
- Consumes: `requirePermission` (Task 4), `getUserPermissions`/`authorize` (Task 4), `ROUTE_PERMISSIONS` (Task 5).

- [ ] **Step 1: Replace requireAdmin usages in API routes**

`requireAdmin()` is used in routes that now map to a specific permission. For each API route file that calls `requireAdmin`, replace it with `requirePermission("<perm from ROUTE_PERMISSIONS>")`. Find them:

Run: `grep -rln "requireAdmin" src/app/api --include=route.ts`

For each file, change:

```ts
// before
import { requireAdmin } from "@/lib/apiAuth"
const { session, error } = await requireAdmin()
// after (example for company/auth-policy -> policy:manage)
import { requirePermission } from "@/lib/apiAuth"
const { session, error } = await requirePermission("policy:manage")
```

Use the permission each route maps to in `ROUTE_PERMISSIONS` (Task 5). For a route that was `requireAdmin` but maps to `AUTH_ONLY` (dashboard presets COMPANY-scope check), keep `requireAuth()` and replace the inline `session.user.role !== "ADMIN"` check as in Step 3.

- [ ] **Step 2: Remove or repoint requireAdmin in apiAuth**

If no callers remain, delete `requireAdmin` from `src/lib/apiAuth.ts`. Confirm none remain:

Run: `grep -rn "requireAdmin" src --include=*.ts --include=*.tsx`
Expected: no matches (or only the definition, which you then delete).

- [ ] **Step 3: Fix the two special inline role checks**

`src/app/api/dashboard/presets/route.ts:41` uses `session.user.role !== "ADMIN"` to gate COMPANY-scope presets. Replace with a permission check:

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { prisma } from "@/lib/prisma"
// ...
if (scope === "COMPANY") {
  const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
  if (!authorize(perms, "dashboard:manage_shared")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
}
```

`src/app/api/dashboard/presets/[id]/route.ts:20,42` passes `session.user.role` into `getPresetAndCheck(...)`. Open `src/app/api/dashboard/presets/[id]/route.ts` and the helper it calls; replace the `role` argument with a boolean `canManageShared` computed the same way:

```ts
const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
const canManageShared = authorize(perms, "dashboard:manage_shared")
// pass canManageShared instead of session.user.role; update getPresetAndCheck's
// signature to take `canManageShared: boolean` and use it where it compared role.
```

- [ ] **Step 4: Fix page-level isAdmin flags**

These pages derive `isAdmin` from `session.user.role === "ADMIN"`. Replace each with a permission read. Sites:
- `src/app/(dashboard)/data-api/page.tsx:7` -> `api_credentials:manage`
- `src/app/(dashboard)/data-sources/page.tsx:10` -> `connectors:manage`
- `src/app/(dashboard)/notifications/page.tsx:9` -> `notifications:manage`
- `src/app/(dashboard)/register/page.tsx:7` -> `register:manage`
- `src/app/(dashboard)/setup/page.tsx:20` -> `users:manage` (admin-only auth policy card)
- `src/app/(dashboard)/alerts/page.tsx:25` -> `alerts:remediate`

For each, replace the line with (example for data-api):

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { prisma } from "@/lib/prisma"
// ...
const perms = await getUserPermissions(prisma, session!.user.roleId ?? null)
const isAdmin = authorize(perms, "api_credentials:manage")
```

Keep the downstream prop name `isAdmin` to avoid touching child components; only its source changes. (A later plan can rename these props to be permission-specific.)

- [ ] **Step 5: Fix the session unit test**

`src/lib/auth/session.test.ts` mocks `{ user: { id, role, companyId } }`. Replace `role: "VIEWER"`/`role: "ADMIN"` with `roleId: "role1"` (and `roleId: null` where a no-access case is wanted). Update any assertion referencing `.role`.

- [ ] **Step 6: Typecheck, lint, run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.
Run: `npx dotenv -e .env.local -- npx vitest run`
Expected: all pass, including the RBAC unit + integration tests and the route-coverage test.

- [ ] **Step 7: Grep to confirm no stale role references remain**

Run: `grep -rn "user\.role\b\|=== \"ADMIN\"\|=== \"VIEWER\"" src --include=*.ts --include=*.tsx | grep -v roleId`
Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(rbac): migrate role checks to permission checks"
```

---

## Self-Review

**Spec coverage (Plan 1 slice):** permission catalog (Task 1), presets (Task 2), Role table + `User.roleId` migration + backfill + seeding (Task 3), `authorize`/`requirePermission` central guard + default deny (Task 4), route->permission registry + build-failing coverage test (Task 5), migrating existing `isAdmin`/enum checks (Task 6). The spec's custom-role management UI, anti-escalation, step-up re-auth, audit log, SSO, and break-glass are intentionally in later plans (2 to 4), not this one.

**Placeholder scan:** No "TBD"/"handle edge cases"/"write tests for the above"; every code step shows code, every run step shows the command and expected output. The one dynamic part (Task 5 registry) is grounded by a grep the engineer runs, with a complete baseline map to reconcile against, and the coverage test enforces completeness.

**Type consistency:** `getUserPermissions(db, roleId)` and `authorize(perms, needed)` signatures match across Tasks 4 and 6; `seedPresetsForCompany`/`resolvePresetRoleId` signatures match across Tasks 3 and 4; `session.user.roleId` (additional field set in Task 3 Step 5) is used consistently in Tasks 4 and 6; `ROUTE_PERMISSIONS` keys are the api-relative path used by both the registry (Task 5) and the migration guidance (Task 6).

## Follow-up plans (not this document)

- **Plan 2, RBAC management + audit:** custom role CRUD, role assignment, the no-escalation rule, step-up re-auth, `AuditLog`.
- **Plan 3, SSO login:** `@better-auth/sso`, `SsoConnection`, JIT provisioning, company resolution.
- **Plan 4, Break-glass:** sealed local account, CLI arm + secret, time-box, audit/alert.
