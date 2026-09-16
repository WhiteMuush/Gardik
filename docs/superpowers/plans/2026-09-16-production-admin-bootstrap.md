# Production administrator bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator who deploys the published image create the first company and administrator once, through a single-use invitation, without any default credential and without writing a secret to the logs.

**Architecture:** A Next 16 `register` hook (`src/instrumentation.ts`) calls one function in a new module (`src/lib/auth/bootstrap.ts`). That module is split into a pure configuration parser, a state query, a writer, and a thin orchestrator, so most of it is unit-testable without a database. It reuses `issueInvitation`, `seedPresetsForCompany`, `resolvePresetRoleId` and `writeAudit` rather than restating any of their logic.

**Tech Stack:** TypeScript, Next.js 16.3.4 (standalone output), Prisma with `@prisma/adapter-pg`, Better Auth, Vitest (unit `.test.ts`, integration `.itest.ts`).

**Spec:** `docs/superpowers/specs/2026-09-16-production-admin-bootstrap-design.md`

## Global Constraints

- Branch: `feat/admin-bootstrap`, already created from `develop`.
- No em dash (`-` U+2014) anywhere in code comments, documentation or commit messages. Use a comma, a colon or parentheses.
- No AI attribution in commit messages: no co-author trailer, no generated-with
  footer, no session link. The pre-commit hook enforces this and rejects the
  commit; `.githooks/lib/check-ai-attribution.sh` holds the exact patterns.
- Commit header: 72 characters maximum. The pre-commit hook rejects longer ones.
- Conventional commit prefixes, matching the repository: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`.
- Comments explain why, not what. The repository's existing comments are the reference for tone and density.
- `bootstrapFirstAdmin` must never throw. Every refusal is a log line, never an exception that reaches `register()`.
- Never log the invitation token or any other secret. `docs/production-readiness.md` documents this as policy.
- The local PostgreSQL container must be running for every integration test: `npm run db:up`.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/auth/bootstrap.ts` (create) | Configuration parsing, state query, creation, orchestration. The only new logic. |
| `src/lib/auth/bootstrap.test.ts` (create) | Unit tests for the pure parser. No database. |
| `src/lib/auth/bootstrap.itest.ts` (create) | Integration tests for the state query, the writer and the orchestrator. |
| `src/instrumentation.ts` (create) | Next start-up hook. Calls the orchestrator and nothing else. |
| `src/lib/auth/invitation.ts` (modify) | `issueInvitation` gains a nullable creator, an optional token and an optional TTL. |
| `src/lib/auth/invitation.itest.ts` (modify) | Cover the three new parameter behaviours. |
| `docker/README.hub.md` (modify) | Operator-facing first-start section. Synced to Docker Hub on release. |
| `docs/auth.md` (modify) | Design rationale, for a maintainer. |
| `docs/production-readiness.md` (modify) | Record that the bootstrap link is never logged. |

---

### Task 1: Configuration parser

The pure half of the module: it reads the environment, refuses anything malformed, and hands back a normalised configuration. No database, so it is fast to test and carries most of the refusal cases.

**Files:**
- Create: `src/lib/auth/bootstrap.ts`
- Test: `src/lib/auth/bootstrap.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `BOOTSTRAP_INVITATION_TTL_HOURS: number` (value `24`)
  - `MIN_BOOTSTRAP_TOKEN_LENGTH: number` (value `32`)
  - `type BootstrapConfig = { email: string; token: string; domain: string }`
  - `type ResolveResult = { ok: true; config: BootstrapConfig } | { ok: false; silent: boolean; reason: string }`
  - `type BootstrapEnv = { BOOTSTRAP_ADMIN_EMAIL?: string; BOOTSTRAP_INVITE_TOKEN?: string }`
  - `resolveBootstrapConfig(env: BootstrapEnv): ResolveResult`

`silent: true` means "not configured, say nothing"; `silent: false` means "configured wrongly, say why".

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/bootstrap.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { resolveBootstrapConfig, MIN_BOOTSTRAP_TOKEN_LENGTH } from "./bootstrap"

const token = "a".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)

describe("resolveBootstrapConfig", () => {
  it("stays silent when neither variable is set", () => {
    const result = resolveBootstrapConfig({})
    expect(result).toEqual({ ok: false, silent: true, reason: "not configured" })
  })

  it("names the missing token when only the email is set", () => {
    const result = resolveBootstrapConfig({ BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.silent).toBe(false)
    expect(result.reason).toContain("BOOTSTRAP_INVITE_TOKEN")
  })

  it("names the missing email when only the token is set", () => {
    const result = resolveBootstrapConfig({ BOOTSTRAP_INVITE_TOKEN: token })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.silent).toBe(false)
    expect(result.reason).toContain("BOOTSTRAP_ADMIN_EMAIL")
  })

  it("refuses a token below the minimum length", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com",
      BOOTSTRAP_INVITE_TOKEN: "a".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH - 1),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.silent).toBe(false)
    expect(result.reason).toContain(String(MIN_BOOTSTRAP_TOKEN_LENGTH))
  })

  it("refuses an address with no domain", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses a domain with no dot", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@localhost",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result.ok).toBe(false)
  })

  it("derives the company domain from the address", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result).toEqual({ ok: true, config: { email: "admin@acme.com", token, domain: "acme.com" } })
  })

  it("normalises case and surrounding whitespace on the address", () => {
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "  Admin@ACME.com  ",
      BOOTSTRAP_INVITE_TOKEN: token,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.email).toBe("admin@acme.com")
    expect(result.config.domain).toBe("acme.com")
  })

  it("keeps the token exactly as supplied", () => {
    const mixed = `Aa1-_${"b".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)}`
    const result = resolveBootstrapConfig({
      BOOTSTRAP_ADMIN_EMAIL: "admin@acme.com",
      BOOTSTRAP_INVITE_TOKEN: mixed,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.token).toBe(mixed)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/auth/bootstrap.test.ts`

Expected: FAIL, "Failed to resolve import ./bootstrap" or equivalent, because the module does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/auth/bootstrap.ts`:

```ts
// 24 hours rather than the 72 that INVITATION_TTL_HOURS gives a colleague being
// invited: a deployment is finished in one sitting or the next morning, and an
// expired bootstrap link is reissued by restarting the container, so the shorter
// window costs the operator nothing.
export const BOOTSTRAP_INVITATION_TTL_HOURS = 24

// The token is supplied by the operator rather than generated, so the container
// never has a secret to print. This floor is what stops a caller handing in
// something guessable; `openssl rand -base64 32` clears it comfortably.
export const MIN_BOOTSTRAP_TOKEN_LENGTH = 32

export type BootstrapConfig = { email: string; token: string; domain: string }

// silent distinguishes "nobody asked for a bootstrap", the normal state of every
// running instance and every development machine, from "somebody asked and got
// it wrong", which has to be said out loud.
export type ResolveResult =
  | { ok: true; config: BootstrapConfig }
  | { ok: false; silent: boolean; reason: string }

// Only the two keys this actually reads. Next augments NodeJS.ProcessEnv with a
// required NODE_ENV, so a test passing an object literal against that type would
// not compile; process.env stays assignable to this one.
export type BootstrapEnv = {
  BOOTSTRAP_ADMIN_EMAIL?: string
  BOOTSTRAP_INVITE_TOKEN?: string
}

export function resolveBootstrapConfig(env: BootstrapEnv): ResolveResult {
  const email = (env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase()
  const token = (env.BOOTSTRAP_INVITE_TOKEN ?? "").trim()

  if (email === "" && token === "") {
    return { ok: false, silent: true, reason: "not configured" }
  }
  if (email === "") {
    return { ok: false, silent: false, reason: "BOOTSTRAP_ADMIN_EMAIL is not set" }
  }
  if (token === "") {
    return { ok: false, silent: false, reason: "BOOTSTRAP_INVITE_TOKEN is not set" }
  }
  if (token.length < MIN_BOOTSTRAP_TOKEN_LENGTH) {
    return {
      ok: false,
      silent: false,
      reason: `BOOTSTRAP_INVITE_TOKEN is shorter than ${MIN_BOOTSTRAP_TOKEN_LENGTH} characters`,
    }
  }

  const at = email.lastIndexOf("@")
  const domain = at === -1 ? "" : email.slice(at + 1)
  if (at < 1 || !domain.includes(".") || /\s/.test(email)) {
    return { ok: false, silent: false, reason: "BOOTSTRAP_ADMIN_EMAIL is not a usable address" }
  }

  return { ok: true, config: { email, token, domain } }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/auth/bootstrap.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: no output, exit 0. The type check is not optional here: Vitest strips
types rather than checking them, so a test file can pass every assertion while
failing to compile.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/bootstrap.ts src/lib/auth/bootstrap.test.ts
git commit -m "feat(auth): parse and validate the bootstrap configuration"
```

---

### Task 2: Widen issueInvitation

The bootstrap has no creating administrator, needs to supply its own token so the container never prints one, and wants a shorter expiry. Three parameters, all optional or widened, so every existing call site keeps compiling unchanged.

**Files:**
- Modify: `src/lib/auth/invitation.ts:57-77` (the `issueInvitation` signature and body)
- Test: `src/lib/auth/invitation.itest.ts` (append a describe block)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `issueInvitation(db: Db, args: { userId: string; createdByUserId: string | null; now?: Date; token?: string; ttlHours?: number }): Promise<{ token: string; expiresAt: Date }>`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/auth/invitation.itest.ts`:

```ts
describe("issueInvitation parameters", () => {
  it("accepts a null creator, for an invitation nobody issued by hand", async () => {
    const user = await makeUser("null-creator")
    await issueInvitation(prisma, { userId: user.id, createdByUserId: null })

    const row = await prisma.userInvitation.findFirst({ where: { userId: user.id } })
    expect(row?.createdByUserId).toBeNull()
  })

  it("stores the hash of a supplied token instead of generating one", async () => {
    const user = await makeUser("supplied-token")
    const supplied = `supplied-${suffix}-${"x".repeat(32)}`

    const { token } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: null,
      token: supplied,
    })

    expect(token).toBe(supplied)
    const row = await prisma.userInvitation.findFirst({ where: { userId: user.id } })
    expect(row?.tokenHash).toBe(hashToken(supplied))
  })

  it("honours a shorter ttl than the default", async () => {
    const user = await makeUser("short-ttl")
    const now = new Date()

    const { expiresAt } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: null,
      now,
      ttlHours: 24,
    })

    expect(expiresAt.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000)
  })

  it("still defaults to the standard ttl when none is given", async () => {
    const user = await makeUser("default-ttl")
    const now = new Date()

    const { expiresAt } = await issueInvitation(prisma, {
      userId: user.id,
      createdByUserId: null,
      now,
    })

    expect(expiresAt.getTime()).toBe(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Start the database and run the tests to verify they fail**

Run:
```bash
npm run db:up
npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/auth/invitation.itest.ts
```

Expected: FAIL. TypeScript rejects `createdByUserId: null` and the unknown `token` and `ttlHours` properties.

- [ ] **Step 3: Widen the signature**

In `src/lib/auth/invitation.ts`, replace the `issueInvitation` signature and the first two lines of its body with:

```ts
export async function issueInvitation(
  db: Db,
  {
    userId,
    createdByUserId,
    now = new Date(),
    // Defaulted here rather than at the call site so the generated path stays the
    // one nothing has to think about. The bootstrap supplies its own, because a
    // token it generated would have to be printed to be usable.
    token = generateToken(),
    ttlHours = INVITATION_TTL_HOURS,
  }: {
    userId: string
    // Null for an invitation the system issued with no administrator behind it.
    // The column has always been nullable; only this signature was narrower.
    createdByUserId: string | null
    now?: Date
    token?: string
    ttlHours?: number
  }
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)
```

Delete the now-redundant `const token = generateToken()` line that preceded `const expiresAt`. Leave the rest of the body untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/auth/invitation.itest.ts`

Expected: PASS, the four new tests plus every pre-existing one in the file.

- [ ] **Step 5: Confirm no existing call site broke**

Run: `npx tsc --noEmit && npm run lint`

Expected: no output, exit 0. Widening `createdByUserId` to `string | null` and adding optional parameters is backwards compatible, so this should pass without touching any caller.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/invitation.ts src/lib/auth/invitation.itest.ts
git commit -m "feat(auth): let an invitation carry a supplied token and ttl"
```

---

### Task 3: State query and creation

The database half. `bootstrapState` answers the only question that matters, whether anyone can already sign in. `createFirstAdmin` performs the writes and is safe to run twice, so the fresh and resumable states share one code path.

**Files:**
- Modify: `src/lib/auth/bootstrap.ts` (append)
- Test: `src/lib/auth/bootstrap.itest.ts` (create)

**Interfaces:**
- Consumes: `BootstrapConfig` and `BOOTSTRAP_INVITATION_TTL_HOURS` from Task 1; the widened `issueInvitation` from Task 2.
- Produces:
  - `type Db = PrismaClient | Prisma.TransactionClient`
  - `type BootstrapState = "fresh" | "resumable" | "closed"`
  - `bootstrapState(db: Db, email: string): Promise<BootstrapState>`
  - `createFirstAdmin(db: Db, config: BootstrapConfig): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/bootstrap.itest.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { CREDENTIAL_ISSUER } from "@/lib/auth/account"
import { hashToken } from "./invitation"
import {
  bootstrapState,
  createFirstAdmin,
  BOOTSTRAP_INVITATION_TTL_HOURS,
  MIN_BOOTSTRAP_TOKEN_LENGTH,
} from "./bootstrap"

// The gate only has meaning against an empty database, and the development
// database is never empty. Each test therefore runs inside a transaction that
// first clears every company (users, accounts and invitations cascade from it)
// and is always rolled back, so nothing the suite does survives it.
const ROLLBACK = Symbol("rollback")

async function onEmptyDb<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let captured: T
  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.deleteMany({})
      captured = await fn(tx)
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  return captured!
}

const config = {
  email: "admin@bootstrap.test",
  domain: "bootstrap.test",
  token: `bootstrap-${"z".repeat(MIN_BOOTSTRAP_TOKEN_LENGTH)}`,
}

describe("bootstrapState", () => {
  it("is fresh when the database holds nothing", async () => {
    const state = await onEmptyDb((tx) => bootstrapState(tx, config.email))
    expect(state).toBe("fresh")
  })

  it("is resumable when the administrator exists with no password", async () => {
    const state = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      return bootstrapState(tx, config.email)
    })
    expect(state).toBe("resumable")
  })

  it("is closed as soon as any account carries a password", async () => {
    const state = await onEmptyDb(async (tx) => {
      const company = await tx.company.create({
        data: { name: "Other", domain: "other.test" },
      })
      const user = await tx.user.create({
        data: { email: "someone@other.test", companyId: company.id },
      })
      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          issuer: CREDENTIAL_ISSUER,
          userId: user.id,
          password: await bcrypt.hash("a-password-that-works", 12),
        },
      })
      return bootstrapState(tx, config.email)
    })
    expect(state).toBe("closed")
  })
})

describe("createFirstAdmin", () => {
  it("creates the company, the administrator and the invitation", async () => {
    const result = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const company = await tx.company.findUnique({ where: { domain: config.domain } })
      const user = await tx.user.findUnique({ where: { email: config.email } })
      const role = user?.roleId ? await tx.role.findUnique({ where: { id: user.roleId } }) : null
      const invitation = await tx.userInvitation.findFirst({ where: { userId: user!.id } })
      return { company, user, role, invitation }
    })

    expect(result.company?.name).toBe(config.domain)
    expect(result.user?.companyId).toBe(result.company?.id)
    expect(result.role?.name).toBe("Administrator")
    expect(result.invitation?.tokenHash).toBe(hashToken(config.token))
    expect(result.invitation?.createdByUserId).toBeNull()
  })

  it("leaves the administrator without any credential account", async () => {
    const accounts = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })
      return tx.account.findMany({ where: { userId: user!.id } })
    })
    expect(accounts).toHaveLength(0)
  })

  it("expires the invitation after the bootstrap window, not the default one", async () => {
    const invitation = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })
      return tx.userInvitation.findFirst({ where: { userId: user!.id } })
    })

    const hours = (invitation!.expiresAt.getTime() - invitation!.createdAt.getTime()) / 3_600_000
    expect(Math.round(hours)).toBe(BOOTSTRAP_INVITATION_TTL_HOURS)
  })

  it("run twice, produces one company, one user and one live invitation", async () => {
    const counts = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      await createFirstAdmin(tx, config)
      const user = await tx.user.findUnique({ where: { email: config.email } })
      return {
        companies: await tx.company.count(),
        users: await tx.user.count(),
        live: await tx.userInvitation.count({ where: { userId: user!.id, consumedAt: null } }),
      }
    })

    expect(counts.companies).toBe(1)
    expect(counts.users).toBe(1)
    expect(counts.live).toBe(1)
  })

  it("writes the creation and the invitation to the audit trail, with no actor", async () => {
    const entries = await onEmptyDb(async (tx) => {
      await createFirstAdmin(tx, config)
      return tx.auditLog.findMany({ orderBy: { action: "asc" } })
    })

    expect(entries.map((e) => e.action)).toEqual(["user.create", "user.invite"])
    expect(entries.every((e) => e.actorUserId === null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npm run db:up
npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/auth/bootstrap.itest.ts
```

Expected: FAIL, `bootstrapState` and `createFirstAdmin` are not exported from `./bootstrap`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/auth/bootstrap.ts`, and add the imports at the top of the file:

```ts
import type { Prisma, PrismaClient } from "@prisma/client"
import { issueInvitation, hashToken } from "@/lib/auth/invitation"
import { seedPresetsForCompany, resolvePresetRoleId } from "@/lib/rbac/seed-roles"
import { ADMINISTRATOR } from "@/lib/rbac/presets"
import { writeAudit, AUDIT_ACTIONS } from "@/lib/rbac/audit"

type Db = PrismaClient | Prisma.TransactionClient

export type BootstrapState = "fresh" | "resumable" | "closed"

/**
 * The gate does not ask whether a user exists, it asks whether anyone can already
 * sign in. Under a plain "a user exists" rule a link lost or expired before use
 * would lock the operator out with no recovery short of dropping the database.
 * Resuming is safe because the door closes the moment an account carries a
 * password, which is the only thing that actually grants access.
 */
export async function bootstrapState(db: Db, email: string): Promise<BootstrapState> {
  const withPassword = await db.account.count({ where: { password: { not: null } } })
  if (withPassword > 0) return "closed"

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  return existing ? "resumable" : "fresh"
}

/**
 * Idempotent on purpose: the fresh and resumable states run the same path, and a
 * second run reissues the invitation rather than failing. issueInvitation voids
 * every outstanding one for the user, so this cannot leave two live links behind.
 *
 * No credential account is created. The password is set by the operator through
 * the invitation, under the application's own rules, so nothing here has to
 * restate them.
 */
export async function createFirstAdmin(db: Db, config: BootstrapConfig): Promise<void> {
  const company = await db.company.upsert({
    where: { domain: config.domain },
    update: {},
    create: { name: config.domain, domain: config.domain },
  })

  await seedPresetsForCompany(db, company.id)
  const roleId = await resolvePresetRoleId(db, company.id, ADMINISTRATOR)

  const user = await db.user.upsert({
    where: { email: config.email },
    update: {},
    create: { email: config.email, companyId: company.id, roleId },
  })

  // UserInvitation.tokenHash is unique, and issueInvitation marks outstanding
  // invitations consumed rather than deleting them. The bootstrap token is fixed
  // by the operator, so every restart of a container that still carries the
  // variables would re-create the same hash and violate that constraint. Clearing
  // the unredeemed row first removes nothing of value, keeps issueInvitation as
  // the single writer of invitations, and refreshes the window on every restart.
  await db.userInvitation.deleteMany({
    where: { tokenHash: hashToken(config.token), consumedAt: null },
  })

  await issueInvitation(db, {
    userId: user.id,
    createdByUserId: null,
    token: config.token,
    ttlHours: BOOTSTRAP_INVITATION_TTL_HOURS,
  })

  for (const action of [AUDIT_ACTIONS.USER_CREATE, AUDIT_ACTIONS.USER_INVITE]) {
    await writeAudit(db, {
      companyId: company.id,
      actorUserId: null,
      action,
      targetType: "user",
      targetId: user.id,
    })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/auth/bootstrap.itest.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Confirm the earlier unit tests still pass and the tree type-checks**

Run: `npx vitest run src/lib/auth/bootstrap.test.ts && npx tsc --noEmit && npm run lint`

Expected: PASS then no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/bootstrap.ts src/lib/auth/bootstrap.itest.ts
git commit -m "feat(auth): gate and create the first administrator"
```

---

### Task 4: Orchestrator and start-up hook

The glue. Everything it does is already tested; what this task adds is the guarantee that no failure inside it can stop the server from starting.

**Files:**
- Modify: `src/lib/auth/bootstrap.ts` (append)
- Create: `src/instrumentation.ts`
- Test: `src/lib/auth/bootstrap.itest.ts` (append)

**Interfaces:**
- Consumes: `resolveBootstrapConfig`, `bootstrapState`, `createFirstAdmin` from Tasks 1 and 3.
- Produces: `bootstrapFirstAdmin(client: PrismaClient, env?: BootstrapEnv): Promise<void>` and `register(): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/auth/bootstrap.itest.ts`:

```ts
describe("bootstrapFirstAdmin", () => {
  const env = {
    BOOTSTRAP_ADMIN_EMAIL: config.email,
    BOOTSTRAP_INVITE_TOKEN: config.token,
  }

  it("does nothing and says nothing when unconfigured", async () => {
    const before = await prisma.company.count()
    await bootstrapFirstAdmin(prisma, {})
    expect(await prisma.company.count()).toBe(before)
  })

  it("does nothing when an account already carries a password", async () => {
    // The development database is seeded with a working admin, which is exactly
    // the closed state a running instance is in.
    const before = await prisma.company.count()
    await bootstrapFirstAdmin(prisma, env)
    expect(await prisma.company.count()).toBe(before)
    expect(await prisma.user.findUnique({ where: { email: config.email } })).toBeNull()
  })

  it("never throws when the database is unreachable", async () => {
    const broken = {
      $transaction: async () => {
        throw new Error("connection refused")
      },
    } as unknown as PrismaClient

    await expect(bootstrapFirstAdmin(broken, env)).resolves.toBeUndefined()
  })

  it("never throws on a malformed address", async () => {
    await expect(
      bootstrapFirstAdmin(prisma, { ...env, BOOTSTRAP_ADMIN_EMAIL: "not-an-address" })
    ).resolves.toBeUndefined()
  })

  it("routes every write through one transaction, so a rollback leaves nothing", async () => {
    let transactions = 0
    // Captured rather than asserted in place: bootstrapFirstAdmin swallows every
    // exception by contract, so an assertion thrown inside the callback would be
    // caught and logged, and the test would pass while proving nothing.
    let stateInside: BootstrapState | null = null

    const observed = {
      $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<BootstrapState>) => {
        transactions += 1
        return prisma.$transaction(async (tx) => {
          await tx.company.deleteMany({})
          stateInside = await fn(tx)
          // Roll the whole thing back, including the company, the role presets,
          // the user, the invitation and both audit rows.
          throw ROLLBACK
        })
      },
    } as unknown as PrismaClient

    // The orchestrator swallows the rollback and logs it, which is the contract.
    await expect(bootstrapFirstAdmin(observed, env)).resolves.toBeUndefined()

    expect(transactions).toBe(1)
    expect(stateInside).toBe("fresh")
    expect(await prisma.company.findUnique({ where: { domain: config.domain } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { email: config.email } })).toBeNull()
  })
})
```

Extend the import at the top of the file to include the new symbol and the type:

```ts
import type { Prisma, PrismaClient } from "@prisma/client"
import type { BootstrapState } from "./bootstrap"
import {
  bootstrapState,
  createFirstAdmin,
  bootstrapFirstAdmin,
  BOOTSTRAP_INVITATION_TTL_HOURS,
  MIN_BOOTSTRAP_TOKEN_LENGTH,
} from "./bootstrap"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/auth/bootstrap.itest.ts`

Expected: FAIL, `bootstrapFirstAdmin` is not exported from `./bootstrap`.

- [ ] **Step 3: Write the orchestrator**

Append to `src/lib/auth/bootstrap.ts`, and add `import { appBaseUrl } from "@/lib/appUrl"`
to the imports. Do **not** import `@/lib/prisma` here: that module builds a
`PrismaClient` from `DATABASE_URL` the moment it loads, which would make the
database-free unit tests from Task 1 fail at import time. The caller passes the
client in instead.

```ts
/**
 * Called once per server process at start-up. Refuses far more often than it
 * acts, and says so at most once, because the overwhelmingly common case is an
 * instance that was bootstrapped months ago.
 *
 * Nothing here throws. A replica that starts before the schema is ready, an
 * unreachable database, a half-supplied pair of variables: every one of them is
 * a log line. A failed bootstrap must not turn a running instance into a dead
 * one.
 */
export async function bootstrapFirstAdmin(
  client: PrismaClient,
  env: BootstrapEnv = process.env
): Promise<void> {
  const resolved = resolveBootstrapConfig(env)
  if (!resolved.ok) {
    if (!resolved.silent) console.warn(`[bootstrap] Refused: ${resolved.reason}.`)
    return
  }

  const { email, domain } = resolved.config

  try {
    const state = await client.$transaction(async (tx) => {
      const current = await bootstrapState(tx, email)
      if (current !== "closed") await createFirstAdmin(tx, resolved.config)
      return current
    })

    if (state === "closed") return

    // The token is never printed. It came from the operator's own configuration,
    // so they already hold it, and a log line carrying it would outlive the link
    // in whatever aggregator collects it.
    // Said differently on a resume, because a container that keeps the variables
    // runs this on every restart and "Created" would be a lie from the second one
    // onwards. The link is reissued either way, so the second line always holds.
    console.info(
      state === "fresh"
        ? `[bootstrap] Created company ${domain} and administrator ${email}.`
        : `[bootstrap] Reissued the invitation for ${email} at company ${domain}.`
    )
    console.info(`[bootstrap] Open ${appBaseUrl()}/invite with the token you supplied.`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn(`[bootstrap] Refused: ${detail}.`)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts src/lib/auth/bootstrap.itest.ts`

Expected: PASS, 13 tests.

- [ ] **Step 5: Create the start-up hook**

Create `src/instrumentation.ts`:

```ts
/**
 * Next runs this once per server process, before the first request. The only
 * thing wired here is the first-administrator bootstrap, which decides for
 * itself whether it has anything to do; see src/lib/auth/bootstrap.ts.
 *
 * The runtime check matters: Next also loads this file in the edge runtime,
 * where Prisma cannot open a connection.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const [{ bootstrapFirstAdmin }, { prisma }] = await Promise.all([
    import("@/lib/auth/bootstrap"),
    import("@/lib/prisma"),
  ])
  await bootstrapFirstAdmin(prisma)
}
```

- [ ] **Step 6: Verify the application still builds and starts**

Run: `npm run build`

Expected: build succeeds. The output lists `instrumentation` among the compiled server files.

- [ ] **Step 7: Run the whole suite and the linter**

Run: `npm test && npx tsc --noEmit && npm run lint`

Expected: 250 pre-existing unit tests plus the 9 from Task 1 pass, then no output, exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/bootstrap.ts src/lib/auth/bootstrap.itest.ts src/instrumentation.ts
git commit -m "feat(auth): run the administrator bootstrap at start-up"
```

---

### Task 5: Documentation

Three files, no new page, and no change to the documentation index at `README.md:222-226`. The operator-facing one is synced to Docker Hub by `docker-publish.yml` on every release, so it is the page somebody reads before anything else.

**Files:**
- Modify: `docker/README.hub.md` (compose example, new section, configuration table)
- Modify: `docs/auth.md` (new section)
- Modify: `docs/production-readiness.md` (logging policy bullet)

**Interfaces:**
- Consumes: the variable names and behaviour fixed in Tasks 1, 3 and 4.
- Produces: nothing code depends on.

- [ ] **Step 1: Add the variable to the compose example in `docker/README.hub.md`**

In the `environment:` block of the `app` service in the Quick start section, after `BETTER_AUTH_URL`, add:

```yaml
      # First start only, both together. Remove them once the password is set.
      BOOTSTRAP_ADMIN_EMAIL: admin@yourdomain.com
      BOOTSTRAP_INVITE_TOKEN: replace-with-openssl-rand-base64-32
```

- [ ] **Step 2: Add the First administrator section to `docker/README.hub.md`**

Insert between the end of `## Quick start` and the start of `## Configuration`:

```markdown
## First administrator

A fresh database has no accounts and public sign-up is disabled, so the first
administrator is created at start-up, once.

Set both variables before the first `docker compose up -d`:

    BOOTSTRAP_ADMIN_EMAIL=admin@acme.com
    BOOTSTRAP_INVITE_TOKEN=$(openssl rand -base64 32)

The domain of the address becomes the company: `admin@acme.com` creates a
company named `acme.com`, which you can rename later in the settings. A token
shorter than 32 characters is refused.

The container then logs two lines, and no secret:

    [bootstrap] Created company acme.com and administrator admin@acme.com.
    [bootstrap] Open https://gardik.example.com/invite with the token you supplied.

Open `<BETTER_AUTH_URL>/invite?token=<BOOTSTRAP_INVITE_TOKEN>`, choose a
password, and enrol a second factor if the company requires one. Remove both
variables afterwards.

**The link is the only credential.** No password is ever read from the
environment, and there is no default account to change: an image nobody has
bootstrapped has no way in at all.

**It closes for good.** The step is skipped as soon as any account has a
password, so it cannot be used later to add an administrator to a running
instance.

**If the link expires or is lost,** restart the container with a fresh
`BOOTSTRAP_INVITE_TOKEN`. A new link is issued for as long as nobody has set a
password, and the previous one is voided. The window is 24 hours.
```

- [ ] **Step 3: Add both variables to the optional configuration table in `docker/README.hub.md`**

Append to the Optional table:

```markdown
| `BOOTSTRAP_ADMIN_EMAIL` | Creates the first administrator on start. See First administrator. |
| `BOOTSTRAP_INVITE_TOKEN` | Invitation token for that first administrator. 32 characters minimum. |
```

- [ ] **Step 4: Add the rationale section to `docs/auth.md`**

Append after the `## Two-factor authentication` section:

```markdown
## First administrator

A deployed image has no company and no account, and `disableSignUp: true` means
nobody can create one. `src/lib/auth/bootstrap.ts`, wired through
`src/instrumentation.ts`, closes that gap at start-up when
`BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_INVITE_TOKEN` are both set.

It issues an invitation rather than setting a password. Everything about
passwords, validation, verification and the forced second factor already exists
in `invitation.ts` and `(auth)/secure`, and a second implementation of those
rules would eventually disagree with the first.

The token is supplied by the operator, not generated. A generated token would
have to be printed to be usable, and `docs/production-readiness.md` forbids
writing secrets to the logs.

The gate asks whether any account carries a password, not whether any user
exists. The stricter-looking rule is the more fragile one: a link lost before
use would lock the operator out permanently. Testing for a password instead lets
a restart reissue the invitation, while still closing the door the instant
anybody can genuinely sign in.
```

- [ ] **Step 5: Record the decision in `docs/production-readiness.md`**

Append to the bullet list under `## Logging policy (zero PII / secrets)`:

```markdown
- The first-administrator bootstrap logs the company and the administrator
  address, never the invitation token. The token is supplied through
  `BOOTSTRAP_INVITE_TOKEN` precisely so the container never has one to print.
```

- [ ] **Step 6: Verify the compliance checks pass**

Run: `npm run lint && npm run licenses`

Expected: no output from the linter, and `[licenses] ok` from the second.

- [ ] **Step 7: Commit**

```bash
git add docker/README.hub.md docs/auth.md docs/production-readiness.md
git commit -m "docs: document the first administrator bootstrap"
```

---

## Final verification

- [ ] **Run every suite against a running database**

```bash
npm run db:up
npm test
npx dotenv -e .env.local -- npx vitest run --config vitest.integration.config.ts
npx tsc --noEmit
npm run lint
npm run licenses
npm run build
```

Expected: every suite passes, the type check and the linter print nothing, the
license gate prints `ok`, and the build succeeds.

- [ ] **Confirm the bootstrap is inert on this machine**

Run: `npm run dev`

Expected: no `[bootstrap]` line appears. Neither variable is set in `.env.local`,
so the hook returns silently, which is the behaviour every development machine
and every running instance should see.
