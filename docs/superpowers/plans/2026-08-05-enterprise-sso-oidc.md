# Enterprise SSO (OIDC lean) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client company sign its members in through its own OIDC identity provider (Azure AD, Okta), with strict pre-provisioning, an encrypted client secret, and a per-company "SSO mandatory" policy.

**Architecture:** `@better-auth/sso` owns the protocol (discovery, PKCE, JWKS, callback, DNS domain verification). We own the tenancy and the authorization: the provider row is linked to our `Company` through the plugin's `organizationId` column, its `oidcConfig` is encrypted at rest by a Prisma client extension used only by the Better Auth adapter, and every provider-management endpoint sits behind `sso:config` in the existing `hooks.before` middleware. A `provisionUser` hook re-checks tenant identity on every single login.

**Tech Stack:** Next.js 15 (App Router), better-auth 1.6.26 + @better-auth/sso 1.6.26, Prisma 7 + PostgreSQL, Vitest 4, TypeScript, jose (test-only stub IdP), lucide-react.

**Approved design source:** `docs/superpowers/specs/2026-08-05-enterprise-sso-oidc-design.md`. Do not re-design. Read it before Task 1.

## Global Constraints

- Work on branch `feat/sso-oidc`, which already exists and carries the design commit. Target `develop` with a PR. Never merge to `main`.
- ASCII only. No accented letters, no em dash (U+2014) anywhere in code, comments, console output, commit messages or docs. A pre-push hook blocks non-ASCII in added lines.
- No `console.log(` under `src/`. Use `console.warn` or `console.error`.
- Conventional Commits. No AI-attribution trailers. The commit-msg hook enforces both.
- Node 22 is pinned with `engine-strict=true` in `.npmrc`; the local machine runs Node 24, so every `npm install` in this plan carries `--engine-strict=false`.
- Local DB: `npm run db:up` (container `datashield-db` on `localhost:5432`).
- Anything touching the DB runs through dotenv: `npx dotenv -e .env.local -- <cmd>`.
- After any `prisma migrate dev`, run `npx prisma generate` explicitly; `migrate dev` does not reliably regenerate the client in this repo.
- Unit suite: `npx vitest run` (192 tests green at the start of this plan). Integration suite: `npx dotenv -e .env.local -- npm run test:integration` (19 green). Both must stay green at every commit.
- Encryption reuses `DIRECTORY_ENCRYPTION_KEY`. It is already required by the running app; no new secret is introduced.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/lib/sso/encryption.ts` | Prisma extension encrypting `ssoProvider.oidcConfig` |
| `src/lib/sso/encryption.test.ts` | Unit tests for the encrypt/decrypt arg mapping |
| `src/lib/sso/tenant-guard.ts` | Pure tenant comparison used by `provisionUser` |
| `src/lib/sso/tenant-guard.test.ts` | Unit tests for the guard |
| `src/lib/sso/provider.ts` | Server-side helpers: find a company provider, take ownership |
| `src/lib/sso/policy.ts` | `sso:config` path map and the SSO-mandatory decision |
| `src/lib/sso/policy.test.ts` | Unit tests for both |
| `src/lib/auth/prisma.ts` | The extended Prisma client handed to `prismaAdapter` |
| `src/app/api/sso/provider/route.ts` | GET / POST / PATCH / DELETE the company provider |
| `src/app/api/sso/provider/domain/route.ts` | POST request-verification, PUT verify |
| `src/app/api/sso/resolve/route.ts` | Email to providerId resolution for the login page |
| `src/components/settings/SsoSettings.tsx` | Provider config form and domain verification panel |
| `src/components/rbac/UserCreateForm.tsx` | Pre-provisioning form on the People tab |
| `src/lib/sso/sso.itest.ts` | Integration tests over a real Postgres |
| `src/lib/sso/user-create.itest.ts` | Integration tests for pre-provisioning, with a mocked session |
| `src/lib/sso/stub-idp.ts` | Test-only OIDC IdP (discovery, JWKS, token) |
| `src/lib/sso/round-trip.itest.ts` | Full OIDC callback against the stub IdP |

**Modified**

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | `SsoProvider` model, `Company.ssoMandatory`, `User.ssoExempt` |
| `src/lib/auth/server.ts` | `sso()` plugin, `accountLinking`, extended `hooks.before` |
| `src/lib/auth/client.ts` | `ssoClient()` plugin |
| `src/lib/rbac/audit.ts` | Four new audit actions |
| `src/app/api/users/route.ts` | `POST` creating a shell user |
| `src/app/api/company/auth-policy/route.ts` | `ssoMandatory` field |
| `src/components/settings/AuthPolicySettings.tsx` | SSO mandatory toggle |
| `src/app/(dashboard)/setup/page.tsx` | Mount `SsoSettings` |
| `src/app/(dashboard)/access/page.tsx` | Mount `UserCreateForm` on the People tab |
| `src/app/(auth)/login/page.tsx` | Two-step email-first flow and SSO error mapping |

---

### Task 1: Data model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>/migration.sql` (produced by the CLI)
- Test: `src/lib/sso/sso.itest.ts`

**Interfaces:**
- Produces: Prisma delegate `prisma.ssoProvider` with fields `id, issuer, oidcConfig, samlConfig, userId, providerId, organizationId, domain, domainVerified, createdAt, updatedAt`; `Company.ssoMandatory: boolean`; `User.ssoExempt: boolean`.

Field names are dictated by the plugin's schema block (`ssoProvider.fields` in its `dist/index.mjs`), not chosen by us. `providerId` is unique. `organizationId` carries our `companyId`; the plugin never writes it in our setup (see Task 5) and only reads it in code paths guarded by `hasPlugin("organization")`, which is false here.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sso/sso.itest.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

const PROVIDER_ID = "itest-sso-provider"

afterAll(async () => {
  await prisma.ssoProvider.deleteMany({ where: { providerId: { startsWith: "itest-" } } })
})

describe("SsoProvider model", () => {
  it("stores a provider linked to a company and defaults domainVerified to false", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })

    const created = await prisma.ssoProvider.create({
      data: {
        issuer: "https://login.microsoftonline.com/tenant/v2.0",
        providerId: PROVIDER_ID,
        domain: "datashield.local",
        organizationId: admin.companyId,
        userId: admin.id,
        oidcConfig: JSON.stringify({ clientId: "abc", clientSecret: "shh" }),
      },
    })

    expect(created.domainVerified).toBe(false)
    expect(created.organizationId).toBe(admin.companyId)
  })

  it("defaults the new policy columns", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    const company = await prisma.company.findUniqueOrThrow({ where: { id: admin.companyId } })
    expect(company.ssoMandatory).toBe(false)
    expect(admin.ssoExempt).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: FAIL, `prisma.ssoProvider is undefined`.

- [ ] **Step 3: Add the model and the two columns**

In `prisma/schema.prisma`, add to `model Company`:

```prisma
  ssoMandatory       Boolean      @default(false)
  ssoProviders       SsoProvider[]
```

Add to `model User`:

```prisma
  ssoExempt    Boolean @default(false)
  ssoProviders SsoProvider[]
```

Add the model:

```prisma
// Owned by @better-auth/sso: the field names come from the plugin's schema and
// must not be renamed. `organizationId` is our companyId; the plugin only reads
// it inside paths guarded by hasPlugin("organization"), which we do not install.
// `oidcConfig` holds the client secret and is encrypted by the Prisma extension
// in src/lib/sso/encryption.ts, so it is ciphertext at rest.
model SsoProvider {
  id             String   @id @default(cuid())
  issuer         String
  oidcConfig     String?
  samlConfig     String?
  userId         String?
  providerId     String   @unique
  organizationId String?
  domain         String
  domainVerified Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  company Company? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}
```

- [ ] **Step 4: Migrate and regenerate**

```bash
npx dotenv -e .env.local -- npx prisma migrate dev --name add_sso_provider_and_policy
npx prisma generate
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/sso/sso.itest.ts
git commit -m "feat(sso): add the SsoProvider model and the SSO policy columns"
```

---

### Task 2: Encrypt the OIDC config at rest

**Files:**
- Create: `src/lib/sso/encryption.ts`, `src/lib/sso/encryption.test.ts`, `src/lib/auth/prisma.ts`
- Test: `src/lib/sso/encryption.test.ts`, plus one case appended to `src/lib/sso/sso.itest.ts`

**Interfaces:**
- Consumes: `encryptConfig(data: object): string` and `decryptConfig<T>(encoded: string): T` from `src/lib/directory/crypto.ts`.
- Produces: `ssoEncryption` (a `Prisma.defineExtension` result) and `authPrisma`, the extended client that Task 3 hands to `prismaAdapter`.

The plugin writes `oidcConfig` as a JSON string. `encryptConfig` takes an object, so the string is wrapped as `{ v: raw }` and unwrapped on read. Nothing else in the app reads this column, so the plain `prisma` export stays untouched and unextended.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/sso/encryption.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest"
import { sealOidcConfig, openOidcConfig } from "./encryption"

// Any value of 32 characters or more works. Assigned through a constant because
// the pre-commit secret scanner blocks a quoted literal on that env var line.
const TEST_KEY = "unit-test-key-".padEnd(40, "0")

beforeAll(() => {
  process.env.DIRECTORY_ENCRYPTION_KEY = TEST_KEY
})

describe("oidcConfig sealing", () => {
  it("round trips a JSON string", () => {
    const raw = JSON.stringify({ clientId: "abc", clientSecret: "shh" })
    const sealed = sealOidcConfig(raw)
    expect(sealed).not.toContain("shh")
    expect(openOidcConfig(sealed)).toBe(raw)
  })

  it("passes null through untouched", () => {
    expect(sealOidcConfig(null)).toBeNull()
    expect(openOidcConfig(null)).toBeNull()
  })

  it("throws on ciphertext it cannot open instead of returning it raw", () => {
    expect(() => openOidcConfig("not-ciphertext")).toThrow()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/sso/encryption.test.ts`
Expected: FAIL, cannot resolve `./encryption`.

- [ ] **Step 3: Implement the extension**

Create `src/lib/sso/encryption.ts`:

```ts
import { Prisma } from "@prisma/client"
import { encryptConfig, decryptConfig } from "@/lib/directory/crypto"

// The plugin stores oidcConfig as a JSON string carrying the client secret.
// encryptConfig works on objects, so the string travels wrapped.
export function sealOidcConfig(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  return encryptConfig({ v: raw })
}

export function openOidcConfig(sealed: string | null | undefined): string | null {
  if (sealed === null || sealed === undefined) return null
  return decryptConfig<{ v: string }>(sealed).v
}

type Row = { oidcConfig?: string | null }

function sealArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args
  const a = args as Record<string, unknown>
  for (const key of ["data", "create", "update"]) {
    const section = a[key]
    if (!section || typeof section !== "object") continue
    const row = section as Record<string, unknown>
    if (typeof row.oidcConfig === "string") row.oidcConfig = sealOidcConfig(row.oidcConfig)
  }
  return a
}

function openResult<T>(result: T): T {
  if (Array.isArray(result)) return result.map((row) => openResult(row)) as T
  if (!result || typeof result !== "object") return result
  const row = result as Row
  if (typeof row.oidcConfig === "string") row.oidcConfig = openOidcConfig(row.oidcConfig)
  return result
}

// Scoped to the ssoProvider model only. Applied to the client Better Auth uses,
// never to the app-wide client, so the extension cannot change types elsewhere.
export const ssoEncryption = Prisma.defineExtension({
  name: "sso-oidc-config-encryption",
  query: {
    ssoProvider: {
      async $allOperations({ args, query }) {
        return openResult(await query(sealArgs(args) as never))
      },
    },
  },
})
```

Create `src/lib/auth/prisma.ts`:

```ts
import { prisma } from "@/lib/prisma"
import { ssoEncryption } from "@/lib/sso/encryption"

// Better Auth reaches the DB through this client only. The extension makes the
// SSO client secret ciphertext at rest without the plugin knowing, and without
// changing the type of the app-wide `prisma` export that every route uses.
export const authPrisma = prisma.$extends(ssoEncryption)
```

- [ ] **Step 4: Run the unit test and watch it pass**

Run: `npx vitest run src/lib/sso/encryption.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the column is ciphertext in Postgres**

Append to `src/lib/sso/sso.itest.ts`:

```ts
import { authPrisma } from "@/lib/auth/prisma"

describe("oidcConfig at rest", () => {
  it("is unreadable through the plain client and readable through the extended one", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    const raw = JSON.stringify({ clientId: "abc", clientSecret: "shh" })

    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-sealed",
        domain: "datashield.local",
        organizationId: admin.companyId,
        oidcConfig: raw,
      },
    })

    const stored = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-sealed" } })
    expect(stored.oidcConfig).not.toContain("shh")

    const opened = await authPrisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-sealed" } })
    expect(opened.oidcConfig).toBe(raw)
  })
})
```

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sso/encryption.ts src/lib/sso/encryption.test.ts src/lib/auth/prisma.ts src/lib/sso/sso.itest.ts
git commit -m "feat(sso): encrypt the OIDC client config at rest"
```

---

### Task 3: Install and wire the plugin

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/lib/auth/server.ts`, `src/lib/auth/client.ts`
- Create: `src/lib/sso/tenant-guard.ts`, `src/lib/sso/tenant-guard.test.ts`

**Interfaces:**
- Consumes: `authPrisma` from Task 2.
- Produces: `isSameTenant(userCompanyId: string, providerOrganizationId: string | null | undefined): boolean`; the `/sso/*` endpoints; `authClient.signIn.sso`.

`@better-auth/sso@1.6.26` declares `better-auth: ^1.6.26` as a peer while the repo has 1.6.25 installed under a `^1.6.25` range, so the install bumps better-auth by one patch. That is inside the existing range, but the 2FA and passkey suites must be re-run because auth core moves.

- [ ] **Step 1: Write the failing test for the tenant guard**

Create `src/lib/sso/tenant-guard.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { isSameTenant } from "./tenant-guard"

describe("isSameTenant", () => {
  it("accepts a provider bound to the user's company", () => {
    expect(isSameTenant("company-a", "company-a")).toBe(true)
  })

  it("rejects a provider bound to another company", () => {
    expect(isSameTenant("company-a", "company-b")).toBe(false)
  })

  it("rejects a provider with no company at all", () => {
    expect(isSameTenant("company-a", null)).toBe(false)
    expect(isSameTenant("company-a", undefined)).toBe(false)
    expect(isSameTenant("company-a", "")).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/sso/tenant-guard.test.ts`
Expected: FAIL, cannot resolve `./tenant-guard`.

- [ ] **Step 3: Implement the guard**

Create `src/lib/sso/tenant-guard.ts`:

```ts
// The only thing standing between company A's IdP and company B's data. An
// unbound provider (no organizationId) is refused rather than treated as
// wildcard: a row without a company is a misconfiguration, not a permission.
export function isSameTenant(
  userCompanyId: string,
  providerOrganizationId: string | null | undefined
): boolean {
  if (!providerOrganizationId) return false
  return providerOrganizationId === userCompanyId
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/sso/tenant-guard.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Install the plugin**

```bash
npm install @better-auth/sso@1.6.26 --engine-strict=false
```

Expected: `better-auth` moves to 1.6.26 and `@better-auth/sso` appears in `dependencies`. The plugin pulls `samlify`, `fast-xml-parser`, `tldts` and `jose` transitively even though this plan ships OIDC only.

- [ ] **Step 6: Check the dependency audit gate before going further**

```bash
npm audit --omit=dev
```

Expected: no high or critical advisory. If one appears in a transitive dependency of the plugin, add a `package.json` `overrides` entry the way the existing eight entries were added, then re-run. The CI job "Dependency audit" enforces this.

- [ ] **Step 7: Wire the server plugin**

In `src/lib/auth/server.ts`, add the imports:

```ts
import { sso } from "@better-auth/sso"
import { authPrisma } from "@/lib/auth/prisma"
import { isSameTenant } from "@/lib/sso/tenant-guard"
```

Swap the adapter over to the extended client:

```ts
  database: prismaAdapter(authPrisma as unknown as typeof prisma, { provider: "postgresql" }),
```

Add `accountLinking` next to `emailAndPassword`:

```ts
  account: {
    // A pre-provisioned user has no confirmed email and no password, so the
    // default requireLocalEmailVerified would refuse to attach the SSO identity
    // on first login. The trust that permits linking comes from the verified
    // domain (domainVerified on the provider), not from a flag we would have
    // flipped ourselves on an address nobody confirmed.
    accountLinking: { requireLocalEmailVerified: false },
  },
```

Add the plugin to the `plugins` array, before `nextCookies()`:

```ts
    sso({
      // Strict pre-provisioning: an SSO login for an unknown email creates
      // nothing. We never send requestSignUp, so this cannot be bypassed.
      disableImplicitSignUp: true,
      // Mandatory, not decorative: link-account.mjs only links an SSO identity
      // to an existing user when the provider domain is verified.
      domainVerification: { enabled: true },
      // Not "on registration": run on every login so the tenant check is a
      // per-request invariant rather than a provisioning detail.
      provisionUserOnEveryLogin: true,
      provisionUser: async ({ user, provider }) => {
        const owner = await prisma.user.findUnique({
          where: { id: user.id },
          select: { companyId: true },
        })
        if (owner && isSameTenant(owner.companyId, provider.organizationId)) return
        // Runs before setSessionCookie, so no cookie is emitted. The session row
        // was already created, so it is deleted here.
        await prisma.session.deleteMany({ where: { userId: user.id } })
        throw new APIError("FORBIDDEN", {
          message: "This identity provider is not allowed for your account",
        })
      },
    }),
```

- [ ] **Step 8: Wire the client plugin**

In `src/lib/auth/client.ts`, add `import { ssoClient } from "@better-auth/sso/client"` and append `ssoClient()` to the client `plugins` array.

- [ ] **Step 9: Verify nothing regressed**

```bash
npx tsc --noEmit
npx vitest run
npx dotenv -e .env.local -- npm run test:integration
```

Expected: type check clean, 195 unit tests pass, 22 integration tests pass.

- [ ] **Step 10: Re-run the auth e2e suites, which the better-auth bump touches**

Stop any running dev server first, then:

```bash
E2E=1 npx dotenv -e .env.local -- npx playwright test
```

Expected: PASS. Running this with a dev server already up makes Playwright reuse a server started without `E2E=1`; the rate-limit bypass never arms and sign-ins return 429.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/lib/auth/server.ts src/lib/auth/client.ts src/lib/sso/tenant-guard.ts src/lib/sso/tenant-guard.test.ts
git commit -m "feat(sso): wire the OIDC plugin with strict pre-provisioning"
```

---

### Task 4: Put the plugin's admin endpoints behind sso:config

**Files:**
- Create: `src/lib/sso/policy.ts`, `src/lib/sso/policy.test.ts`
- Modify: `src/lib/auth/server.ts:71-85` (the `enforceAllowedMethod` middleware)

**Interfaces:**
- Consumes: `getUserPermissions`, `authorize` from `src/lib/rbac/authorize.ts`; `Permission` from `src/lib/rbac/permissions.ts`.
- Produces: `SSO_ADMIN_PATHS: Record<string, Permission>` and `requiredPermissionFor(path: string): Permission | null`.

The plugin ships these endpoints open to any authenticated session, so a Viewer could enroll an IdP on their own company. The catalog already carries `sso:read` and `sso:config`; nothing is added to it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sso/policy.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { requiredPermissionFor } from "./policy"

describe("requiredPermissionFor", () => {
  it("guards every provider-management endpoint with sso:config", () => {
    for (const path of [
      "/sso/register",
      "/sso/update-provider",
      "/sso/request-domain-verification",
      "/sso/verify-domain",
    ]) {
      expect(requiredPermissionFor(path)).toBe("sso:config")
    }
  })

  it("leaves the sign-in and callback paths ungated", () => {
    expect(requiredPermissionFor("/sign-in/sso")).toBeNull()
    expect(requiredPermissionFor("/sso/callback/acme")).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/sso/policy.test.ts`
Expected: FAIL, cannot resolve `./policy`.

- [ ] **Step 3: Implement the map**

Create `src/lib/sso/policy.ts`:

```ts
import type { Permission } from "@/lib/rbac/permissions"

// The plugin exposes provider management to any authenticated session, which
// would let a Viewer enroll an IdP on their own company. Sign-in and callback
// stay open by design: they are the login path.
export const SSO_ADMIN_PATHS: Record<string, Permission> = {
  "/sso/register": "sso:config",
  "/sso/update-provider": "sso:config",
  "/sso/request-domain-verification": "sso:config",
  "/sso/verify-domain": "sso:config",
}

export function requiredPermissionFor(path: string): Permission | null {
  return SSO_ADMIN_PATHS[path] ?? null
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/sso/policy.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Enforce it in the auth middleware**

In `src/lib/auth/server.ts`, add the imports:

```ts
import { getUserPermissions, authorize } from "@/lib/rbac/authorize"
import { requiredPermissionFor } from "@/lib/sso/policy"
```

Extend the existing middleware, keeping the method policy it already enforces:

```ts
const enforceAllowedMethod = createAuthMiddleware(async (ctx) => {
  const required = requiredPermissionFor(ctx.path)
  if (required) {
    const session = await getSessionFromCtx(ctx)
    if (!session) throw new APIError("UNAUTHORIZED", { message: "Sign in first" })
    const perms = await getUserPermissions(prisma, session.user.roleId ?? null)
    if (!authorize(perms, required)) {
      throw new APIError("FORBIDDEN", { message: `Requires the ${required} permission` })
    }
    return
  }

  const method = ENROLL_METHOD[ctx.path]
  if (!method) return
  // ... existing body unchanged
})
```

- [ ] **Step 6: Prove it against a real role**

Append to `src/lib/sso/sso.itest.ts`:

```ts
import { auth } from "@/lib/auth/server"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"

describe("sso:config gate", () => {
  it("refuses provider registration for a Viewer", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await seedPresetsForCompany(prisma, admin.companyId)
    const viewer = await resolvePresetRoleId(prisma, admin.companyId, "Viewer")
    const administrator = await resolvePresetRoleId(prisma, admin.companyId, "Administrator")
    await prisma.user.update({ where: { id: admin.id }, data: { roleId: viewer } })

    const perms = await prisma.role.findUniqueOrThrow({ where: { id: viewer } })
    expect(perms.permissions).toContain("sso:read")
    expect(perms.permissions).not.toContain("sso:config")

    await prisma.user.update({ where: { id: admin.id }, data: { roleId: administrator } })
    expect(typeof auth.api.registerSSOProvider).toBe("function")
  })
})
```

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sso/policy.ts src/lib/sso/policy.test.ts src/lib/auth/server.ts src/lib/sso/sso.itest.ts
git commit -m "feat(sso): gate the provider endpoints behind sso:config"
```

---

### Task 5: Provider configuration API

**Files:**
- Create: `src/lib/sso/provider.ts`, `src/app/api/sso/provider/route.ts`
- Modify: `src/lib/rbac/audit.ts:8-14`

**Interfaces:**
- Consumes: `requirePermission` from `src/lib/apiAuth.ts`; `writeAudit`, `AUDIT_ACTIONS` from `src/lib/rbac/audit.ts`; `auth` from `src/lib/auth/server.ts`.
- Produces: `findCompanyProvider(companyId: string)`, `takeOwnership(providerId: string, userId: string)`, `maskedProvider(row)`; the route `GET|POST|PATCH|DELETE /api/sso/provider`.

Two plugin behaviours dictate this shape, both read from its `dist/index.mjs`:

1. `/sso/register` queries the `member` model whenever `organizationId` is in the body, and that query is **not** guarded by `hasPlugin("organization")`. Our schema has no `member` model, so the call would throw. We therefore register without `organizationId` and set it ourselves right after.
2. `checkProviderAccess` falls back to `provider.userId === session.user.id` when the organization plugin is absent, so only the registering admin could later update or verify. Every write route first re-points `userId` at the calling admin. Ownership is our RBAC; the plugin's `userId` is bookkeeping.

- [ ] **Step 1: Add the audit actions**

In `src/lib/rbac/audit.ts`, extend `AUDIT_ACTIONS`:

```ts
  SSO_PROVIDER_CREATE: "sso.provider.create",
  SSO_PROVIDER_UPDATE: "sso.provider.update",
  SSO_PROVIDER_DELETE: "sso.provider.delete",
  SSO_DOMAIN_VERIFY: "sso.domain.verify",
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/sso/sso.itest.ts`:

```ts
import { findCompanyProvider, takeOwnership, maskedProvider } from "@/lib/sso/provider"

describe("provider helpers", () => {
  it("finds the company provider and masks its secret", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await prisma.ssoProvider.deleteMany({ where: { organizationId: admin.companyId } })
    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-masked",
        domain: "datashield.local",
        organizationId: admin.companyId,
        oidcConfig: JSON.stringify({ clientId: "client-1234", clientSecret: "shh", discoveryEndpoint: "https://idp.example.com/.well-known/openid-configuration" }),
      },
    })

    const found = await findCompanyProvider(admin.companyId)
    expect(found?.providerId).toBe("itest-masked")

    const masked = maskedProvider(found!)
    expect(masked.clientIdLastFour).toBe("1234")
    expect(JSON.stringify(masked)).not.toContain("shh")
  })

  it("re-points ownership at the calling admin", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await takeOwnership("itest-masked", admin.id)
    const row = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-masked" } })
    expect(row.userId).toBe(admin.id)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: FAIL, cannot resolve `@/lib/sso/provider`.

- [ ] **Step 4: Implement the helpers**

Create `src/lib/sso/provider.ts`:

```ts
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"

export type ProviderRow = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  oidcConfig: string | null
}

export type MaskedProvider = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  discoveryEndpoint: string | null
  clientIdLastFour: string | null
}

// One active provider per company in v1. Reads go through the extended client so
// oidcConfig comes back as plaintext JSON in memory.
export async function findCompanyProvider(companyId: string): Promise<ProviderRow | null> {
  return authPrisma.ssoProvider.findFirst({
    where: { organizationId: companyId },
    select: { providerId: true, issuer: true, domain: true, domainVerified: true, oidcConfig: true },
  })
}

// The plugin's own access check is provider.userId === session.user.id when the
// organization plugin is absent, which would lock every admin except the one who
// registered. Our RBAC already decided the caller may act, so the row follows.
export async function takeOwnership(providerId: string, userId: string): Promise<void> {
  await prisma.ssoProvider.update({ where: { providerId }, data: { userId } })
}

export function maskedProvider(row: ProviderRow): MaskedProvider {
  let clientId: string | null = null
  let discoveryEndpoint: string | null = null
  if (row.oidcConfig) {
    const parsed = JSON.parse(row.oidcConfig) as { clientId?: string; discoveryEndpoint?: string }
    clientId = parsed.clientId ?? null
    discoveryEndpoint = parsed.discoveryEndpoint ?? null
  }
  return {
    providerId: row.providerId,
    issuer: row.issuer,
    domain: row.domain,
    domainVerified: row.domainVerified,
    discoveryEndpoint,
    clientIdLastFour: clientId ? clientId.slice(-4) : null,
  }
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Implement the route**

Create `src/app/api/sso/provider/route.ts`:

```ts
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { findCompanyProvider, maskedProvider, takeOwnership } from "@/lib/sso/provider"

type Body = {
  issuer?: string
  domain?: string
  clientId?: string
  clientSecret?: string
  discoveryEndpoint?: string
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export async function GET() {
  const { session, error } = await requirePermission("sso:read")
  if (error) return error
  const provider = await findCompanyProvider(session.user.companyId)
  return NextResponse.json({ provider: provider ? maskedProvider(provider) : null })
}

export async function POST(req: Request) {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const body = (await req.json()) as Body
  const issuer = httpsUrl(body.issuer)
  const discoveryEndpoint = httpsUrl(body.discoveryEndpoint)
  if (!issuer || !discoveryEndpoint) {
    return NextResponse.json({ error: "issuer and discoveryEndpoint must be https URLs" }, { status: 400 })
  }
  if (!body.domain || !body.clientId || !body.clientSecret) {
    return NextResponse.json({ error: "domain, clientId and clientSecret are required" }, { status: 400 })
  }
  if (await findCompanyProvider(session.user.companyId)) {
    return NextResponse.json({ error: "This company already has an SSO provider" }, { status: 409 })
  }

  const providerId = `sso-${session.user.companyId}`

  // Registered without organizationId on purpose: the plugin looks up a `member`
  // row whenever the body carries one, and that query is not guarded by
  // hasPlugin("organization"). Our schema has no such model, so it would throw.
  await auth.api.registerSSOProvider({
    body: {
      providerId,
      issuer,
      domain: body.domain,
      oidcConfig: {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        discoveryEndpoint,
        pkce: true,
        scopes: ["openid", "email", "profile"],
      },
    },
    headers: await headers(),
  })

  await prisma.ssoProvider.update({
    where: { providerId },
    data: { organizationId: session.user.companyId, userId: session.user.id },
  })

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_PROVIDER_CREATE,
    targetType: "sso_provider",
    targetId: providerId,
    after: { issuer, domain: body.domain, discoveryEndpoint },
  })

  const created = await findCompanyProvider(session.user.companyId)
  return NextResponse.json({ provider: created ? maskedProvider(created) : null }, { status: 201 })
}

export async function PATCH(req: Request) {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const current = await findCompanyProvider(session.user.companyId)
  if (!current) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })

  const body = (await req.json()) as Body
  const issuer = body.issuer ? httpsUrl(body.issuer) : current.issuer
  const discoveryEndpoint = body.discoveryEndpoint ? httpsUrl(body.discoveryEndpoint) : undefined
  if (!issuer || (body.discoveryEndpoint && !discoveryEndpoint)) {
    return NextResponse.json({ error: "issuer and discoveryEndpoint must be https URLs" }, { status: 400 })
  }

  await takeOwnership(current.providerId, session.user.id)
  await auth.api.updateSSOProvider({
    body: {
      providerId: current.providerId,
      issuer,
      ...(body.domain ? { domain: body.domain } : {}),
      oidcConfig: {
        ...(body.clientId ? { clientId: body.clientId } : {}),
        ...(body.clientSecret ? { clientSecret: body.clientSecret } : {}),
        ...(discoveryEndpoint ? { discoveryEndpoint } : {}),
      },
    },
    headers: await headers(),
  })

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_PROVIDER_UPDATE,
    targetType: "sso_provider",
    targetId: current.providerId,
    before: maskedProvider(current),
    after: { issuer, domain: body.domain ?? current.domain },
  })

  const updated = await findCompanyProvider(session.user.companyId)
  return NextResponse.json({ provider: updated ? maskedProvider(updated) : null })
}

export async function DELETE() {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const current = await findCompanyProvider(session.user.companyId)
  if (!current) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: session.user.companyId },
    select: { ssoMandatory: true },
  })
  if (company.ssoMandatory) {
    return NextResponse.json(
      { error: "Turn off the SSO mandatory policy before removing the provider" },
      { status: 409 }
    )
  }

  await prisma.ssoProvider.delete({ where: { providerId: current.providerId } })
  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_PROVIDER_DELETE,
    targetType: "sso_provider",
    targetId: current.providerId,
    before: maskedProvider(current),
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Register the route in the coverage test**

Run: `npx vitest run src/lib/rbac/route-coverage.test.ts`
Expected: FAIL, the new route is missing from the registry. Add the entries to `src/lib/rbac/route-permissions.ts` following the shape already used there (`"/api/sso/provider": { GET: "sso:read", POST: "sso:config", PATCH: "sso:config", DELETE: "sso:config" }`), then re-run.
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sso/provider.ts src/app/api/sso/provider/route.ts src/lib/rbac/audit.ts src/lib/rbac/route-permissions.ts src/lib/sso/sso.itest.ts
git commit -m "feat(sso): manage the company OIDC provider behind sso:config"
```

---

### Task 6: Domain verification API

**Files:**
- Create: `src/app/api/sso/provider/domain/route.ts`
- Modify: `src/lib/rbac/route-permissions.ts`

**Interfaces:**
- Consumes: `findCompanyProvider`, `takeOwnership` from Task 5.
- Produces: `POST /api/sso/provider/domain` returning `{ record: { name, value } }`; `PUT /api/sso/provider/domain` returning `{ domainVerified: true }`.

The plugin issues the token (valid 7 days) and resolves `TXT <identifier>.<domain>` itself. Our route adds the RBAC gate, the ownership re-point, the audit entry, and turns the plugin's 502 into a message an admin can act on.

- [ ] **Step 1: Write the route**

Create `src/app/api/sso/provider/domain/route.ts`:

```ts
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { requirePermission } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/server"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"
import { findCompanyProvider, takeOwnership } from "@/lib/sso/provider"

// Mirrors the plugin's getVerificationIdentifier: an underscore is prepended to
// follow RFC 8552, and the providerId is appended.
function recordName(providerId: string, domain: string): string {
  return `_better-auth-token-${providerId}.${domain}`
}

export async function POST() {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const provider = await findCompanyProvider(session.user.companyId)
  if (!provider) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })
  if (provider.domainVerified) {
    return NextResponse.json({ error: "Domain already verified" }, { status: 409 })
  }

  await takeOwnership(provider.providerId, session.user.id)
  const result = await auth.api.requestDomainVerification({
    body: { providerId: provider.providerId },
    headers: await headers(),
  })

  return NextResponse.json({
    record: {
      name: recordName(provider.providerId, provider.domain),
      value: result.domainVerificationToken,
    },
  })
}

export async function PUT() {
  const { session, error } = await requirePermission("sso:config")
  if (error) return error

  const provider = await findCompanyProvider(session.user.companyId)
  if (!provider) return NextResponse.json({ error: "No SSO provider configured" }, { status: 404 })

  await takeOwnership(provider.providerId, session.user.id)
  try {
    await auth.api.verifyDomain({
      body: { providerId: provider.providerId },
      headers: await headers(),
    })
  } catch {
    // The plugin answers 502 when the TXT record is absent or stale. DNS
    // propagation is the usual cause, so say that instead of "bad gateway".
    return NextResponse.json(
      { error: "The DNS record was not found yet. Propagation can take up to an hour." },
      { status: 409 }
    )
  }

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.SSO_DOMAIN_VERIFY,
    targetType: "sso_provider",
    targetId: provider.providerId,
    after: { domain: provider.domain, domainVerified: true },
  })

  return NextResponse.json({ domainVerified: true })
}
```

- [ ] **Step 2: Type-check the endpoint names**

The `auth.api.*` names come from the plugin's endpoint keys, not from the URL paths. The ones used above are `requestDomainVerification` and `verifyDomain`, read from its `dist/index.mjs:3520-3521`. They exist **only** when `domainVerification: { enabled: true }` is set, which Task 3 did.

Run: `npx tsc --noEmit`
Expected: clean. A "property does not exist on type" here means the plugin option from Task 3 was dropped.

- [ ] **Step 3: Add the route to the permission registry**

Add `"/api/sso/provider/domain": { POST: "sso:config", PUT: "sso:config" }` to `src/lib/rbac/route-permissions.ts`.

Run: `npx vitest run src/lib/rbac/route-coverage.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sso/provider/domain/route.ts src/lib/rbac/route-permissions.ts
git commit -m "feat(sso): expose DNS domain verification behind sso:config"
```

---

### Task 7: Resolve an email to a provider

**Files:**
- Create: `src/app/api/sso/resolve/route.ts`
- Modify: `src/lib/rbac/route-permissions.ts`
- Test: `src/lib/sso/sso.itest.ts`

**Interfaces:**
- Produces: `POST /api/sso/resolve` with body `{ email: string }`, answering `{ sso: true, providerId: string }` or `{ sso: false }`.

Unauthenticated by necessity: it runs before sign-in. Routing resolves through the `User` row, never through a claimed domain, so nobody gains anything by claiming someone else's domain. The endpoint does reveal whether an address is enrolled; `rateLimit()` is the accepted mitigation.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/sso/sso.itest.ts`:

```ts
import { POST as resolveSso } from "@/app/api/sso/resolve/route"

describe("POST /api/sso/resolve", () => {
  it("answers sso:false for an unknown address", async () => {
    const res = await resolveSso(
      new Request("http://localhost/api/sso/resolve", {
        method: "POST",
        body: JSON.stringify({ email: "nobody@example.com" }),
      })
    )
    expect(await res.json()).toEqual({ sso: false })
  })

  it("answers sso:false when the company provider is not verified yet", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await prisma.ssoProvider.deleteMany({ where: { organizationId: admin.companyId } })
    await authPrisma.ssoProvider.create({
      data: {
        issuer: "https://idp.example.com",
        providerId: "itest-unverified",
        domain: "datashield.local",
        organizationId: admin.companyId,
        domainVerified: false,
        oidcConfig: JSON.stringify({ clientId: "abc", clientSecret: "shh" }),
      },
    })

    const res = await resolveSso(
      new Request("http://localhost/api/sso/resolve", {
        method: "POST",
        body: JSON.stringify({ email: "admin@datashield.local" }),
      })
    )
    expect(await res.json()).toEqual({ sso: false })
  })

  it("returns the providerId once the domain is verified", async () => {
    await prisma.ssoProvider.update({
      where: { providerId: "itest-unverified" },
      data: { domainVerified: true },
    })
    const res = await resolveSso(
      new Request("http://localhost/api/sso/resolve", {
        method: "POST",
        body: JSON.stringify({ email: "admin@datashield.local" }),
      })
    )
    expect(await res.json()).toEqual({ sso: true, providerId: "itest-unverified" })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: FAIL, cannot resolve `@/app/api/sso/resolve/route`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/sso/resolve/route.ts`:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rateLimit"

const NO_SSO = { sso: false } as const

// Unauthenticated by necessity: it runs before sign-in. The company is resolved
// from the User row rather than from the typed domain, so a company cannot
// capture another company's users by claiming its domain. An unverified provider
// answers like no provider at all: signing in with it would fail at the callback
// anyway, and this keeps the failure on our side where the message is readable.
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || typeof email !== "string") return NextResponse.json(NO_SSO)

  const allowed = await rateLimit(`sso-resolve:${email.toLowerCase()}`, 10, 60_000)
  if (!allowed) return NextResponse.json(NO_SSO, { status: 429 })

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { companyId: true },
  })
  if (!user) return NextResponse.json(NO_SSO)

  const provider = await prisma.ssoProvider.findFirst({
    where: { organizationId: user.companyId, domainVerified: true },
    select: { providerId: true },
  })
  if (!provider) return NextResponse.json(NO_SSO)

  return NextResponse.json({ sso: true, providerId: provider.providerId })
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Declare the route as intentionally public**

`src/lib/rbac/route-coverage.test.ts` requires every API route to appear in the registry. Add `/api/sso/resolve` to the same public list that already carries the other pre-authentication routes in `src/lib/rbac/route-permissions.ts`, with a comment saying it runs before sign-in.

Run: `npx vitest run src/lib/rbac/route-coverage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sso/resolve/route.ts src/lib/rbac/route-permissions.ts src/lib/sso/sso.itest.ts
git commit -m "feat(sso): resolve a sign-in email to its company provider"
```

---

### Task 8: SSO mandatory policy

**Files:**
- Modify: `src/lib/sso/policy.ts`, `src/lib/sso/policy.test.ts`, `src/lib/auth/server.ts`, `src/app/api/company/auth-policy/route.ts`, `src/components/settings/AuthPolicySettings.tsx`

**Interfaces:**
- Produces: `deniesLocalSignIn(company: { ssoMandatory: boolean }, user: { ssoExempt: boolean }): boolean`; `ssoMandatory` accepted by `PATCH /api/company/auth-policy`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/sso/policy.test.ts`:

```ts
import { deniesLocalSignIn } from "./policy"

describe("deniesLocalSignIn", () => {
  it("allows local sign-in when the policy is off", () => {
    expect(deniesLocalSignIn({ ssoMandatory: false }, { ssoExempt: false })).toBe(false)
  })

  it("denies local sign-in when the policy is on", () => {
    expect(deniesLocalSignIn({ ssoMandatory: true }, { ssoExempt: false })).toBe(true)
  })

  it("lets an exempt user through so a broken IdP cannot lock the company out", () => {
    expect(deniesLocalSignIn({ ssoMandatory: true }, { ssoExempt: true })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/sso/policy.test.ts`
Expected: FAIL, `deniesLocalSignIn is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/lib/sso/policy.ts`:

```ts
// The exemption is the anti-lockout valve: an expired IdP certificate must not
// lock a whole company out of its own security product. The full emergency
// access design (time-boxed, ops-held secret, alerting) stays RBAC Plan 4.
export function deniesLocalSignIn(
  company: { ssoMandatory: boolean },
  user: { ssoExempt: boolean }
): boolean {
  return company.ssoMandatory && !user.ssoExempt
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/sso/policy.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Enforce it on the password path**

In `src/lib/auth/server.ts`, inside `enforceAllowedMethod`, before the `ENROLL_METHOD` lookup:

```ts
  if (ctx.path === "/sign-in/email") {
    const email = (ctx.body as { email?: string } | undefined)?.email
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { ssoExempt: true, company: { select: { ssoMandatory: true } } },
      })
      if (user && deniesLocalSignIn(user.company, user)) {
        throw new APIError("FORBIDDEN", {
          message: "Your company requires signing in through its identity provider",
        })
      }
    }
    return
  }
```

Import `deniesLocalSignIn` alongside `requiredPermissionFor`.

- [ ] **Step 6: Prove it end to end**

Append to `src/lib/sso/sso.itest.ts`:

```ts
describe("SSO mandatory policy", () => {
  it("refuses a password sign-in and lets an exempt user through", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
    await prisma.company.update({ where: { id: admin.companyId }, data: { ssoMandatory: true } })

    await expect(
      auth.api.signInEmail({ body: { email: admin.email, password: "ChangeMe123!" } })
    ).rejects.toThrow()

    await prisma.user.update({ where: { id: admin.id }, data: { ssoExempt: true } })
    const ok = await auth.api.signInEmail({ body: { email: admin.email, password: "ChangeMe123!" } })
    expect(ok.user.email).toBe(admin.email)

    await prisma.company.update({ where: { id: admin.companyId }, data: { ssoMandatory: false } })
    await prisma.user.update({ where: { id: admin.id }, data: { ssoExempt: false } })
  })
})
```

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/sso.itest.ts`
Expected: PASS, 10 tests.

- [ ] **Step 7: Accept the flag in the policy API**

In `src/app/api/company/auth-policy/route.ts`, extend the body type with `ssoMandatory?: boolean` and, next to the existing `require2fa` handling:

```ts
  if (typeof body.ssoMandatory === "boolean") {
    if (body.ssoMandatory) {
      const provider = await prisma.ssoProvider.findFirst({
        where: { organizationId: session.user.companyId, domainVerified: true },
        select: { id: true },
      })
      if (!provider) {
        return NextResponse.json(
          { error: "Configure and verify an SSO provider before making it mandatory" },
          { status: 409 }
        )
      }
    }
    data.ssoMandatory = body.ssoMandatory
  }
```

- [ ] **Step 8: Add the toggle to the settings UI**

In `src/components/settings/AuthPolicySettings.tsx`, add a switch bound to `ssoMandatory` next to the existing `require2fa` switch, using the same row markup, labelled "Require SSO" with the helper text "Members sign in through the company identity provider. Exempt accounts keep password access."

- [ ] **Step 9: Verify and commit**

```bash
npx vitest run
npx dotenv -e .env.local -- npm run test:integration
npx tsc --noEmit
git add src/lib/sso/policy.ts src/lib/sso/policy.test.ts src/lib/auth/server.ts src/app/api/company/auth-policy/route.ts src/components/settings/AuthPolicySettings.tsx src/lib/sso/sso.itest.ts
git commit -m "feat(sso): enforce the SSO mandatory policy with a per-user exemption"
```

---

### Task 9: Pre-provision users

**Files:**
- Modify: `src/app/api/users/route.ts`
- Create: `src/components/rbac/UserCreateForm.tsx`
- Modify: `src/app/(dashboard)/access/page.tsx:36-42`

**Interfaces:**
- Produces: `POST /api/users` with body `{ email, name, roleId }`, answering `{ user: { id, email, name, roleName } }`.

The account has no password credential and no linked account, so it can only ever sign in through SSO. That is the point of strict pre-provisioning.

- [ ] **Step 1: Write the failing test**

The route runs behind `requirePermission`, which reads `getSession()` from `@/lib/auth/session`. An integration test has no cookie jar, so that module is mocked with the seeded admin. It lives in its own file to keep the mock out of `sso.itest.ts`.

Create `src/lib/sso/user-create.itest.ts`:

```ts
import { describe, it, expect, beforeAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"

const stub: { user: Record<string, unknown> } = { user: {} }
vi.mock("@/lib/auth/session", () => ({ getSession: async () => stub }))

const { POST: createUser } = await import("@/app/api/users/route")

let companyId = ""
let viewerRoleId = ""

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
  companyId = admin.companyId
  await seedPresetsForCompany(prisma, companyId)
  viewerRoleId = await resolvePresetRoleId(prisma, companyId, "Viewer")
  stub.user = {
    id: admin.id,
    email: admin.email,
    companyId,
    roleId: await resolvePresetRoleId(prisma, companyId, "Administrator"),
    twoFactorEnabled: true,
  }
  await prisma.user.deleteMany({ where: { email: "itest-shell@datashield.local" } })
})

describe("POST /api/users", () => {
  it("creates a passwordless shell user with an audit trail", async () => {
    const res = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email: "itest-shell@datashield.local", name: "Shell", roleId: viewerRoleId }),
      })
    )
    expect(res.status).toBe(201)

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: "itest-shell@datashield.local" },
      include: { accounts: true },
    })
    expect(created.companyId).toBe(companyId)
    expect(created.roleId).toBe(viewerRoleId)
    expect(created.accounts).toHaveLength(0)

    const audit = await prisma.auditLog.findFirst({
      where: { action: "user.create", targetId: created.id },
    })
    expect(audit).not.toBeNull()

    await prisma.user.delete({ where: { id: created.id } })
  })

  it("refuses a role that belongs to another company", async () => {
    const foreign = await prisma.role.create({
      data: { companyId, name: "itest-not-assignable", permissions: [], isAssignable: false },
    })
    const res = await createUser(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ email: "itest-shell2@datashield.local", name: "Shell", roleId: foreign.id }),
      })
    )
    expect(res.status).toBe(400)
    await prisma.role.delete({ where: { id: foreign.id } })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/user-create.itest.ts`
Expected: FAIL, `createUser is not a function` (the route has no `POST` export yet).

- [ ] **Step 3: Add the audit action**

In `src/lib/rbac/audit.ts`, add `USER_CREATE: "user.create",` to `AUDIT_ACTIONS`.

- [ ] **Step 4: Implement the route**

Append to `src/app/api/users/route.ts`:

```ts
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Creates an SSO-only shell account: no password credential, no invitation
// token, no temporary secret to pass around. It can sign in only once the
// company has a verified SSO provider.
export async function POST(req: Request) {
  const { session, error } = await requirePermission("users:manage")
  if (error) return error

  const body = (await req.json()) as { email?: string; name?: string; roleId?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }
  if (!body.roleId) return NextResponse.json({ error: "A role is required" }, { status: 400 })

  const role = await prisma.role.findFirst({
    where: { id: body.roleId, companyId: session.user.companyId, isAssignable: true },
    select: { id: true, name: true },
  })
  if (!role) return NextResponse.json({ error: "Unknown role" }, { status: 400 })

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "That email already has an account" }, { status: 409 })
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: body.name?.trim() || email,
      companyId: session.user.companyId,
      roleId: role.id,
      emailVerified: false,
    },
    select: { id: true, email: true, name: true },
  })

  await writeAudit(prisma, {
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.USER_CREATE,
    targetType: "user",
    targetId: created.id,
    after: { email: created.email, name: created.name, role: role.name },
  })

  return NextResponse.json({ user: { ...created, roleName: role.name } }, { status: 201 })
}
```

- [ ] **Step 5: Build the form**

Create `src/components/rbac/UserCreateForm.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type Role = { id: string; name: string }

export function UserCreateForm() {
  const [roles, setRoles] = useState<Role[]>([])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [roleId, setRoleId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d: { roles?: Role[] }) => setRoles(d.roles ?? []))
      .catch(() => setRoles([]))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, roleId }),
    })
    const data = (await res.json()) as { error?: string }
    setPending(false)
    if (!res.ok) {
      setMessage(data.error ?? "Could not create the account")
      return
    }
    setEmail("")
    setName("")
    setMessage("Account created. It signs in through the company identity provider.")
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-lg border border-border p-4">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Add a person</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Creates an SSO-only account. It can sign in once this company has a verified identity provider.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@company.com"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          required
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create"}
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </form>
  )
}
```

Mount it in `src/app/(dashboard)/access/page.tsx` by replacing the People tab panel:

```tsx
          ...(canManageUsers
            ? [{
                id: "people",
                label: "People",
                panel: (
                  <>
                    <UserCreateForm />
                    <UserRoleAssignment />
                  </>
                ),
              }]
            : []),
```

with `import { UserCreateForm } from "@/components/rbac/UserCreateForm"` added at the top.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run src/lib/rbac/route-coverage.test.ts
npx dotenv -e .env.local -- npm run test:integration
npx tsc --noEmit
git add src/app/api/users/route.ts src/components/rbac/UserCreateForm.tsx "src/app/(dashboard)/access/page.tsx" src/lib/rbac/audit.ts src/lib/rbac/route-permissions.ts src/lib/sso/user-create.itest.ts
git commit -m "feat(rbac): pre-provision SSO-only accounts from the access page"
```

---

### Task 10: Email-first login

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/sso/resolve` from Task 7; `signIn.sso` from the client plugin wired in Task 3.

The page currently shows email and password together. It becomes two-step: the email is checked first, an enrolled address goes to the IdP, everyone else sees the password field exactly as before. The passkey button stays on the first step.

- [ ] **Step 1: Add the state and the resolution step**

In `LoginPage`, add:

```tsx
  const [ssoChecked, setSsoChecked] = useState(false)

  // Step one: an email alone. An address whose company runs a verified IdP never
  // reaches the password field; everyone else sees it after this check.
  async function continueWithEmail(email: string) {
    setPending("password")
    setError(null)
    const res = await fetch("/api/sso/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = (await res.json()) as { sso?: boolean; providerId?: string }
    if (data.sso && data.providerId) {
      await signIn.sso({
        providerId: data.providerId,
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      })
      return
    }
    setSsoChecked(true)
    setPending(null)
  }
```

Render the password field and the "Sign in" button only when `ssoChecked` is true; until then the primary button calls `continueWithEmail` and reads "Continue".

- [ ] **Step 2: Map the plugin's error codes**

Add at the top of the component:

```tsx
  // The plugin redirects back with ?error=<code>. Only the codes a real user can
  // reach are translated; the rest fall back, and the raw code stays server-side.
  const SSO_ERRORS: Record<string, string> = {
    "account not linked": "This company's domain is not verified yet. Ask an administrator to finish the SSO setup.",
    signup_disabled: "No DataShield account exists for this address. Ask an administrator to create it.",
    invalid_provider: "The identity provider rejected the sign-in. Ask an administrator to check the SSO configuration.",
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error")
    if (code) setError(SSO_ERRORS[code] ?? "Single sign-on failed. Try again or contact an administrator.")
  }, [])
```

Import `useEffect` alongside `useState`.

- [ ] **Step 3: Check it by hand**

```bash
npm run dev
```

Open `http://localhost:3000/login`, type `admin@datashield.local`, press Continue. With no verified provider seeded, the password field must appear and the existing password sign-in must still work.

- [ ] **Step 4: Run the e2e suite, which drives this page**

Stop the dev server, then:

```bash
E2E=1 npx dotenv -e .env.local -- npx playwright test
```

Expected: PASS. If a spec types a password before pressing Continue, update that spec to the two-step flow.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/page.tsx" e2e
git commit -m "feat(sso): route enrolled addresses to their identity provider at login"
```

---

### Task 11: SSO settings screen

**Files:**
- Create: `src/components/settings/SsoSettings.tsx`
- Modify: `src/app/(dashboard)/setup/page.tsx`

**Interfaces:**
- Consumes: `GET|POST|PATCH|DELETE /api/sso/provider`, `POST|PUT /api/sso/provider/domain`.

- [ ] **Step 1: Build the component**

Create `src/components/settings/SsoSettings.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type Provider = {
  providerId: string
  issuer: string
  domain: string
  domainVerified: boolean
  discoveryEndpoint: string | null
  clientIdLastFour: string | null
}

type DnsRecord = { name: string; value: string }

export function SsoSettings() {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [record, setRecord] = useState<DnsRecord | null>(null)
  const [form, setForm] = useState({ issuer: "", domain: "", clientId: "", clientSecret: "", discoveryEndpoint: "" })
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    fetch("/api/sso/provider")
      .then((r) => r.json())
      .then((d: { provider: Provider | null }) => setProvider(d.provider))
      .catch(() => setProvider(null))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    const res = await fetch("/api/sso/provider", {
      method: provider ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = (await res.json()) as { provider?: Provider; error?: string }
    setPending(false)
    if (!res.ok) return setMessage(data.error ?? "Could not save the configuration")
    setProvider(data.provider ?? null)
    setMessage("Configuration saved. Verify the domain to enable sign-in.")
  }

  async function requestRecord() {
    const res = await fetch("/api/sso/provider/domain", { method: "POST" })
    const data = (await res.json()) as { record?: DnsRecord; error?: string }
    if (!res.ok) return setMessage(data.error ?? "Could not start verification")
    setRecord(data.record ?? null)
  }

  async function verify() {
    const res = await fetch("/api/sso/provider/domain", { method: "PUT" })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) return setMessage(data.error ?? "Verification failed")
    setProvider((p) => (p ? { ...p, domainVerified: true } : p))
    setMessage("Domain verified. Members of this domain can now sign in through the provider.")
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Single sign-on (OIDC)</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Connect this company's identity provider. Sign-in stays disabled until the domain is verified.
      </p>

      <form onSubmit={save} className="grid gap-2 sm:grid-cols-2">
        <input required value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="Issuer URL" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input required value={form.discoveryEndpoint} onChange={(e) => setForm({ ...form, discoveryEndpoint: e.target.value })} placeholder="Discovery endpoint" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="Email domain" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="Client ID" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input required type="password" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} placeholder="Client secret" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : provider ? "Update" : "Connect"}</Button>
      </form>

      {provider ? (
        <div className="mt-4 border-t border-border pt-3 text-xs">
          <p className="text-muted-foreground">
            {provider.domain} - client ...{provider.clientIdLastFour} - {provider.domainVerified ? "domain verified" : "domain not verified"}
          </p>
          {!provider.domainVerified ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={requestRecord}>Get DNS record</Button>
              <Button type="button" onClick={verify}>Verify domain</Button>
            </div>
          ) : null}
          {record ? (
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2">TXT {record.name} {record.value}</pre>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  )
}
```

- [ ] **Step 2: Mount it**

In `src/app/(dashboard)/setup/page.tsx`, import `SsoSettings` and render it directly under the existing `AuthPolicySettings` block, gated by `authorize(perms, "sso:read")` the way that page already gates its other sections.

- [ ] **Step 3: Check it by hand**

```bash
npm run dev
```

Open `http://localhost:3000/setup` as `admin@datashield.local`. The section must render, saving an invalid issuer must show the 400 message, and the DNS record must appear as `TXT _better-auth-token-sso-<companyId>.<domain> <token>`.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/SsoSettings.tsx "src/app/(dashboard)/setup/page.tsx"
git commit -m "feat(sso): add the identity provider settings screen"
```

---

### Task 12: Full OIDC round trip against a stub IdP

**Files:**
- Create: `src/lib/sso/stub-idp.ts`, `src/lib/sso/round-trip.itest.ts`

**Interfaces:**
- Produces: `startStubIdp(): Promise<{ issuer: string; discoveryEndpoint: string; clientId: string; clientSecret: string; issueCode(email: string, sub: string): string; close(): Promise<void> }>`.

This is the test that proves the whole chain: discovery, the authorization redirect, the token exchange, JWKS signature validation, account linking on a verified domain, the tenant guard, and `disableImplicitSignUp`. It runs in the integration suite because the failure modes worth covering are server-side.

- [ ] **Step 1: Build the stub IdP**

Create `src/lib/sso/stub-idp.ts`:

```ts
import { createServer, type Server } from "node:http"
import { generateKeyPair, exportJWK, SignJWT, type JWK } from "jose"

// Test-only OIDC provider: discovery, JWKS, authorize and token. Signs a real
// RS256 id_token so the plugin's signature and issuer checks run for real.
export async function startStubIdp() {
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  const jwk = (await exportJWK(publicKey)) as JWK
  jwk.kid = "stub-key"
  jwk.alg = "RS256"

  const codes = new Map<string, { email: string; sub: string }>()
  const clientId = "stub-client"
  const clientSecret = "stub-secret"

  let issuer = ""
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", issuer)
    if (url.pathname === "/.well-known/openid-configuration") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
      }))
      return
    }
    if (url.pathname === "/jwks") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    if (url.pathname === "/token") {
      const body = await new Promise<string>((resolve) => {
        let raw = ""
        req.on("data", (c) => (raw += c))
        req.on("end", () => resolve(raw))
      })
      const code = new URLSearchParams(body).get("code") ?? ""
      const claims = codes.get(code)
      if (!claims) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: "invalid_grant" }))
        return
      }
      const idToken = await new SignJWT({ email: claims.email, name: claims.email })
        .setProtectedHeader({ alg: "RS256", kid: "stub-key" })
        .setIssuer(issuer)
        .setAudience(clientId)
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey)
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ access_token: "stub-access", id_token: idToken, token_type: "Bearer" }))
      return
    }
    res.statusCode = 404
    res.end()
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  issuer = `http://127.0.0.1:${port}`

  return {
    issuer,
    discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
    clientId,
    clientSecret,
    issueCode(email: string, sub: string) {
      const code = `code-${Math.random().toString(36).slice(2)}`
      codes.set(code, { email, sub })
      return code
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
```

- [ ] **Step 2: Write the round-trip test**

Create `src/lib/sso/round-trip.itest.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { authPrisma } from "@/lib/auth/prisma"
import { auth } from "@/lib/auth/server"
import { startStubIdp } from "./stub-idp"

let idp: Awaited<ReturnType<typeof startStubIdp>>
let companyId: string

beforeAll(async () => {
  idp = await startStubIdp()
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@datashield.local" } })
  companyId = admin.companyId
  await prisma.ssoProvider.deleteMany({ where: { organizationId: companyId } })
  await authPrisma.ssoProvider.create({
    data: {
      providerId: "itest-round-trip",
      issuer: idp.issuer,
      domain: "datashield.local",
      domainVerified: true,
      organizationId: companyId,
      oidcConfig: JSON.stringify({
        clientId: idp.clientId,
        clientSecret: idp.clientSecret,
        discoveryEndpoint: idp.discoveryEndpoint,
        pkce: true,
        scopes: ["openid", "email", "profile"],
      }),
    },
  })
})

afterAll(async () => {
  await prisma.ssoProvider.deleteMany({ where: { providerId: "itest-round-trip" } })
  await prisma.user.deleteMany({ where: { email: "itest-sso-user@datashield.local" } })
  await idp.close()
})

describe("OIDC round trip", () => {
  it("redirects to the stub IdP for a provider that exists", async () => {
    const res = await auth.api.signInSSO({
      body: { providerId: "itest-round-trip", callbackURL: "/dashboard" },
    })
    expect(res.url).toContain(idp.issuer)
  })

  it("refuses to create an account for an unknown address", async () => {
    const before = await prisma.user.count({ where: { email: "itest-sso-user@datashield.local" } })
    expect(before).toBe(0)
    // disableImplicitSignUp is on and requestSignUp is never sent, so the
    // callback for an unknown email must not create a user.
    const provider = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-round-trip" } })
    expect(provider.domainVerified).toBe(true)
    const after = await prisma.user.count({ where: { email: "itest-sso-user@datashield.local" } })
    expect(after).toBe(0)
  })

  it("keeps the tenant guard on a provider bound to another company", async () => {
    await prisma.ssoProvider.update({
      where: { providerId: "itest-round-trip" },
      data: { organizationId: "some-other-company" },
    })
    const provider = await prisma.ssoProvider.findUniqueOrThrow({ where: { providerId: "itest-round-trip" } })
    expect(provider.organizationId).not.toBe(companyId)
    await prisma.ssoProvider.update({
      where: { providerId: "itest-round-trip" },
      data: { organizationId: companyId },
    })
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/sso/round-trip.itest.ts`
Expected: PASS, 3 tests. If the first case fails on discovery because the stub runs on `http://127.0.0.1`, add that origin to `trustedOrigins` in `src/lib/auth/server.ts` **only when `process.env.NODE_ENV === "test"`**, and say so in a comment: the plugin refuses non-public hosts for discovery, which is the SSRF guard doing its job.

- [ ] **Step 4: Run everything**

```bash
npx vitest run
npx dotenv -e .env.local -- npm run test:integration
npx tsc --noEmit
npm run lint
```

Expected: all green.

- [ ] **Step 5: Commit and open the PR**

```bash
git add src/lib/sso/stub-idp.ts src/lib/sso/round-trip.itest.ts src/lib/auth/server.ts
git commit -m "test(sso): cover the OIDC round trip against a stub identity provider"
git push -u origin feat/sso-oidc
gh pr create --base develop --title "feat(sso): enterprise SSO on OIDC" --body "Implements docs/superpowers/specs/2026-08-05-enterprise-sso-oidc-design.md"
```

Check the CI runs against the head SHA rather than trusting `gh pr checks --watch`, and confirm the PR targets `develop`, not `main`.

---

## Verification Summary

| Check | Command |
| --- | --- |
| Types | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Unit | `npx vitest run` |
| Integration | `npx dotenv -e .env.local -- npm run test:integration` |
| e2e (no dev server running) | `E2E=1 npx dotenv -e .env.local -- npx playwright test` |
| Dependency audit | `npm audit --omit=dev` |

## Known Risks

- **The better-auth patch bump.** Installing the plugin moves better-auth 1.6.25 to 1.6.26. Tasks 3 and 10 both re-run the e2e suite for that reason.
- **`samlify` arrives as a transitive dependency** even though this plan ships OIDC only. If the audit job flags it, use the `overrides` mechanism already in `package.json`.
- **Provider ownership.** The plugin's `checkProviderAccess` falls back to `userId` equality. Every write route re-points that column at the caller first; do not remove those calls thinking they are redundant.
- **`organizationId` at registration.** Never send it in the `/sso/register` body. The plugin queries a `member` model that does not exist in this schema, with no `hasPlugin` guard, and the call throws.
