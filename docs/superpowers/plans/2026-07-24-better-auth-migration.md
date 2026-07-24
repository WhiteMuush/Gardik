# Better Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace next-auth v5 with Better Auth, add a per-company auth policy, and ship TOTP two-factor authentication with encrypted backup codes.

**Architecture:** Seam-preserving migration. A single server-side helper (`getSession`) and the existing `apiAuth` guards are the only contact points with Better Auth, so the 23 API routes stay untouched and the 15 server pages get a mechanical import swap. Sessions move from JWT to database-backed. The in-house multi-tenant model (`Company` / `User` / `role`) is kept; the auth policy lives as fields on `Company`.

**Tech Stack:** Better Auth (`better-auth`), Prisma 7 + PostgreSQL, `bcryptjs` (preserve existing hashes), Next.js 15 App Router, Vitest, Playwright.

## Global Constraints

- Node `22.x`; package manager npm.
- ASCII only in source and docs. No em dash, no accented characters (CI compliance blocks them).
- No comments unless the WHY is non-obvious. No multi-line docstrings.
- No `Co-Authored-By` lines in commits. Conventional Commits; subject 50 chars or fewer.
- Validate at system boundaries only; trust framework guarantees.
- Gates before any PR: `npm run lint -- --max-warnings 0`, `npx tsc --noEmit`, `npx prisma validate`, `npm run build`.
- Do not push to remote unless explicitly asked.
- Existing seeded account `admin@datashield.local` / `ChangeMe123!` must still log in after migration (bcrypt hash preserved).
- Work happens on the current branch `docs/better-auth-migration-spec` or a fresh feature branch, never directly on `main`.

---

### Task 1: Install Better Auth and scaffold the server instance

**Files:**
- Modify: `package.json` (add `better-auth`)
- Create: `src/lib/auth/server.ts`
- Modify: `.env.example:8-13`
- Modify: `docs/auth.md`

**Interfaces:**
- Produces: `auth` (Better Auth instance) from `src/lib/auth/server.ts`, with `emailAndPassword` using bcrypt, `user.additionalFields` for `role` and `companyId`, and the `twoFactor` plugin.

- [ ] **Step 1: Install the dependency**

Run: `npm install better-auth`
Expected: `better-auth` added to `dependencies`, no high/critical advisories from the postinstall audit.

- [ ] **Step 2: Create the server instance**

Create `src/lib/auth/server.ts`:

```typescript
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { twoFactor } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false },
      companyId: { type: "string", input: false },
    },
  },
  plugins: [twoFactor(), nextCookies()],
})
```

- [ ] **Step 3: Update the env template**

In `.env.example`, replace the auth block (lines 8-13) with:

```bash
# Better Auth session secret. Generate one with: openssl rand -base64 32
BETTER_AUTH_SECRET=change-me-to-a-random-secret

# Base URL of the app. Override only if you are not on localhost:3000.
BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Update the auth doc**

In `docs/auth.md`, replace references to `AUTH_SECRET` / `AUTH_URL` and next-auth with `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` and Better Auth. Note that sessions are database-backed and that TOTP two-factor is available per company.

- [ ] **Step 5: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: PASS (no references to the new tables yet; the instance compiles against the current client until Task 2 regenerates it).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/auth/server.ts .env.example docs/auth.md
git commit -m "feat: add better-auth server instance"
```

---

### Task 2: Prisma schema, migration, and seeds

**Files:**
- Modify: `prisma/schema.prisma` (User, Company, new models, enum)
- Create: `prisma/migrations/<timestamp>_better_auth/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `prisma/seed.dev.ts`

**Interfaces:**
- Produces: Prisma models `Session`, `Account`, `Verification`, `TwoFactor`; `User.twoFactorEnabled`, `User.name`, `User.emailVerified`, `User.updatedAt`, `User.image`; `Company.require2fa`, `Company.allowedAuthMethods`; `enum AuthMethod`. Existing `User.hashedPassword` removed; password moved to an `Account` row with `providerId = "credential"`.

- [ ] **Step 1: Edit `User` in `prisma/schema.prisma`**

Replace the `User` model with:

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  emailVerified  Boolean  @default(false)
  name           String   @default("")
  image          String?
  role           Role     @default(VIEWER)
  companyId      String
  twoFactorEnabled Boolean @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  activePresetId  String?

  company          Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  dashboardConfig  DashboardConfig?
  dashboardPresets DashboardPreset[] @relation("UserPresets")
  activePreset     DashboardPreset?  @relation("ActivePreset", fields: [activePresetId], references: [id], onDelete: SetNull)
  sessions         Session[]
  accounts         Account[]
  twoFactor        TwoFactor[]
}
```

- [ ] **Step 2: Add the Better Auth models and enum**

Append to `prisma/schema.prisma`:

```prisma
model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model TwoFactor {
  id          String @id @default(cuid())
  secret      String
  backupCodes String
  userId      String
  user        User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum AuthMethod {
  TOTP
  EMAIL_OTP
  PASSKEY
}
```

- [ ] **Step 3: Add policy fields to `Company`**

In the `Company` model, add after `updatedAt`:

```prisma
  require2fa         Boolean      @default(false)
  allowedAuthMethods AuthMethod[] @default([TOTP])
```

- [ ] **Step 4: Validate the schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 5: Create the migration with the data backfill**

Run: `npx prisma migrate dev --name better_auth --create-only`

Then edit the generated `prisma/migrations/<timestamp>_better_auth/migration.sql`: after the auto-generated `CREATE TABLE` / `ALTER TABLE` statements and BEFORE the statement that drops `hashedPassword`, insert the backfill:

```sql
INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'credential', "id", "hashedPassword", now(), now()
FROM "User";
```

Confirm the `ALTER TABLE "User" DROP COLUMN "hashedPassword";` line stays AFTER that INSERT.

- [ ] **Step 6: Apply the migration**

Run: `npx prisma migrate dev`
Expected: migration applied, Prisma Client regenerated.

- [ ] **Step 7: Update `prisma/seed.ts`**

Replace the admin-user creation so the password lands in an `Account` row instead of `hashedPassword`. The user is created with no password column; the credential account holds the bcrypt hash:

```typescript
const hashed = await bcrypt.hash("ChangeMe123!", 10)
const user = await prisma.user.upsert({
  where: { email: "admin@datashield.local" },
  update: {},
  create: {
    email: "admin@datashield.local",
    name: "Admin",
    role: "ADMIN",
    company: { connect: { id: company.id } },
  },
})
await prisma.account.upsert({
  where: { id: `cred_${user.id}` },
  update: { password: hashed },
  create: {
    id: `cred_${user.id}`,
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: hashed,
  },
})
```

Adjust the surrounding variable names to match the existing seed (keep the existing `company` creation).

- [ ] **Step 8: Mirror the change in `prisma/seed.dev.ts`**

Apply the same user-plus-account pattern to any user created by the dev seed. If the dev seed only reuses the admin from `seed.ts`, no change beyond importing is needed; otherwise repeat the `account.upsert` for each seeded user.

- [ ] **Step 9: Reseed and verify a fresh DB**

Run: `npm run db:down && npm run db:init`
Expected: seed completes without error; the `Account` table has one `credential` row per user.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts prisma/seed.dev.ts
git commit -m "feat: add better-auth tables and per-company auth policy"
```

---

### Task 3: Session helper and apiAuth rewrite

**Files:**
- Create: `src/lib/auth/session.ts`
- Modify: `src/lib/apiAuth.ts`
- Create: `src/lib/auth/session.test.ts`
- Modify: `src/app/api/company/route.test.ts` (only if the mocked session shape needs `user.id`)

**Interfaces:**
- Consumes: `auth` from `src/lib/auth/server.ts`.
- Produces: `getSession(): Promise<AuthResult | null>` where `AuthResult` is `Awaited<ReturnType<typeof auth.api.getSession>>` (has `user.id`, `user.email`, `user.role`, `user.companyId`). `requireAuth()` / `requireAdmin()` keep the `{ session, error }` shape, where `session.user` carries `id`, `role`, `companyId`.

- [ ] **Step 1: Write the session helper**

Create `src/lib/auth/session.ts`:

```typescript
import { headers } from "next/headers"
import { auth } from "./server"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}
```

- [ ] **Step 2: Write the failing apiAuth test**

Create `src/lib/auth/session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }))

import { requireAuth, requireAdmin } from "@/lib/apiAuth"

beforeEach(() => vi.clearAllMocks())

describe("requireAuth", () => {
  it("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null)
    const { session, error } = await requireAuth()
    expect(session).toBeNull()
    expect(error?.status).toBe(401)
  })

  it("passes the session through when authenticated", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", role: "VIEWER", companyId: "co1" } })
    const { session, error } = await requireAuth()
    expect(error).toBeNull()
    expect(session?.user.companyId).toBe("co1")
  })
})

describe("requireAdmin", () => {
  it("returns 403 for a non-admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", role: "VIEWER", companyId: "co1" } })
    const { error } = await requireAdmin()
    expect(error?.status).toBe(403)
  })

  it("allows an admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN", companyId: "co1" } })
    const { session, error } = await requireAdmin()
    expect(error).toBeNull()
    expect(session?.user.role).toBe("ADMIN")
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/auth/session.test.ts`
Expected: FAIL (apiAuth still imports next-auth `auth`).

- [ ] **Step 4: Rewrite `src/lib/apiAuth.ts`**

```typescript
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"

type AuthResult = NonNullable<Awaited<ReturnType<typeof getSession>>>
type Guard = { session: AuthResult; error: null } | { session: null; error: NextResponse }

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const forbidden = () => NextResponse.json({ error: "Admin only" }, { status: 403 })

export async function requireAuth(): Promise<Guard> {
  const session = await getSession()
  if (!session) return { session: null, error: unauthorized() }
  return { session, error: null }
}

export async function requireAdmin(): Promise<Guard> {
  const session = await getSession()
  if (!session) return { session: null, error: unauthorized() }
  if (session.user.role !== "ADMIN") return { session: null, error: forbidden() }
  return { session, error: null }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/auth/session.test.ts`
Expected: PASS

- [ ] **Step 6: Run the existing route tests**

Run: `npx vitest run src/app/api`
Expected: PASS. The route tests mock `@/lib/apiAuth` directly, so they are unaffected. If any test reads `session.user.id` and the mock omits it, add `id` to that mock's session object.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts src/lib/apiAuth.ts
git commit -m "feat: route auth guards through better-auth session"
```

---

### Task 4: Auth route handler and middleware

**Files:**
- Delete: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Modify: `src/middleware.ts`
- Delete: `src/auth.ts`, `src/auth.config.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth/server.ts`, `buildCsp` from `src/lib/csp.ts`.
- Produces: `GET` / `POST` handlers at `/api/auth/*`; middleware that protects routes via an optimistic session-cookie check and stamps the CSP nonce.

- [ ] **Step 1: Create the catch-all handler**

Create `src/app/api/auth/[...all]/route.ts`:

```typescript
import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth/server"

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 2: Delete the old route**

Run: `git rm src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 3: Rewrite the middleware**

Replace `src/middleware.ts` with:

```typescript
import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { buildCsp } from "@/lib/csp"

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isLogin = path === "/login" || path.startsWith("/login/")
  const hasSession = getSessionCookie(req) !== null

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development")

  // Next.js reads the nonce from the request CSP header and stamps it on
  // its own inline scripts; without this the response header would block them.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set("Content-Security-Policy", csp)
  return res
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\..*).*)"],
}
```

- [ ] **Step 4: Delete the next-auth config files**

Run: `git rm src/auth.ts src/auth.config.ts`

- [ ] **Step 5: Verify nothing still imports the deleted modules**

Run: `grep -rn "@/auth\"\|@/auth.config\|next-auth" src`
Expected: only `src/app/(dashboard)` pages still import `@/auth` (fixed in Task 5) and `src/types/next-auth.d.ts` (fixed in Task 9). No other references.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth src/middleware.ts src/auth.ts src/auth.config.ts
git commit -m "feat: mount better-auth handler and cookie-based middleware"
```

---

### Task 5: Swap server pages to getSession

**Files:**
- Modify: the 15 `(dashboard)` pages and layout listed below.

**Interfaces:**
- Consumes: `getSession` from `src/lib/auth/session.ts`.

- [ ] **Step 1: Replace the import and call in every page**

In each file below, change `import { auth } from "@/auth"` to `import { getSession } from "@/lib/auth/session"` and change `const session = await auth()` to `const session = await getSession()`. The downstream `session.user.companyId` / `session.user.role` / `session.user.id` reads are unchanged.

Files:
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/alerts/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/dashboard/widgets/page.tsx`
- `src/app/(dashboard)/data-api/page.tsx`
- `src/app/(dashboard)/data-sources/page.tsx`
- `src/app/(dashboard)/employees/page.tsx`
- `src/app/(dashboard)/notifications/page.tsx`
- `src/app/(dashboard)/register/page.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/app/(dashboard)/setup/page.tsx`
- `src/app/api/dashboard/config/route.ts`
- `src/app/api/dashboard/presets/route.ts`
- `src/app/api/dashboard/presets/[id]/route.ts`
- `src/app/api/dashboard/presets/[id]/activate/route.ts`

For the four API routes, if a route currently returns its own 401 on `!session`, keep that logic; only the import and call change.

- [ ] **Step 2: Handle the null case in pages**

Each page previously relied on the middleware guaranteeing a session. Keep that assumption: if a page dereferences `session.user` without a null check and the middleware already redirects unauthenticated users, add `if (!session) redirect("/login")` at the top using `import { redirect } from "next/navigation"` only where TypeScript now complains that `session` is possibly null.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "refactor: read session via getSession in server pages"
```

---

### Task 6: Login page with two-factor challenge

**Files:**
- Create: `src/lib/auth/client.ts`
- Modify: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth/server.ts` (types only).
- Produces: `authClient` with `signIn`, `signOut`, `twoFactor` from `src/lib/auth/client.ts`.

- [ ] **Step 1: Create the client**

Create `src/lib/auth/client.ts`:

```typescript
import { createAuthClient } from "better-auth/react"
import { twoFactorClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
})

export const { signIn, signOut, twoFactor, useSession } = authClient
```

- [ ] **Step 2: Rewrite the login submit handler**

In `src/app/(auth)/login/page.tsx`, replace the next-auth `signIn` import and `handleSubmit` with the Better Auth flow. Add a `twoFactor` step state:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, twoFactor } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsTotp, setNeedsTotp] = useState(false)
  const router = useRouter()

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    const { data, error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })
    setLoading(false)
    if (error) {
      setError("Invalid email or password")
      return
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setNeedsTotp(true)
      return
    }
    router.push("/dashboard")
  }

  async function handleTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    const { error } = await twoFactor.verifyTotp({ code: String(form.get("code")) })
    setLoading(false)
    if (error) {
      setError("Invalid code")
      return
    }
    router.push("/dashboard")
  }
  // render: when needsTotp is false show the existing email+password form
  // wired to handlePassword; when true show a single 6-digit code input wired
  // to handleTotp. Keep the existing Tailwind classes and layout.
}
```

Keep the existing markup for the email/password form (now calling `handlePassword`) and add a second form, shown when `needsTotp` is true, with one input `name="code"` (numeric, autocomplete `one-time-code`) calling `handleTotp`.

- [ ] **Step 3: Manual smoke of the password path**

Run: `npm run dev`, open `http://localhost:3000/login`, sign in with `admin@datashield.local` / `ChangeMe123!`.
Expected: redirect to `/dashboard` (admin has no 2FA yet, so no code step).

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint -- --max-warnings 0`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/client.ts "src/app/(auth)/login/page.tsx"
git commit -m "feat: login via better-auth with totp challenge"
```

---

### Task 7: TOTP enrollment in settings

**Files:**
- Create: `src/components/settings/TwoFactorSetup.tsx`
- Modify: `src/app/(dashboard)/setup/page.tsx` (mount the component) or the settings page that hosts security options
- Modify: `package.json` (add `qrcode` for rendering the TOTP URI, plus `@types/qrcode`)

**Interfaces:**
- Consumes: `twoFactor` from `src/lib/auth/client.ts`.
- Produces: `TwoFactorSetup` client component handling enable + verify + backup-code display.

- [ ] **Step 1: Add the QR dependency**

Run: `npm install qrcode && npm install -D @types/qrcode`
Expected: added with no high/critical advisories.

- [ ] **Step 2: Write the enrollment component**

Create `src/components/settings/TwoFactorSetup.tsx`:

```typescript
"use client"

import { useState } from "react"
import QRCode from "qrcode"
import { twoFactor } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [password, setPassword] = useState("")
  const [qr, setQr] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(enabled)

  async function enable() {
    setError(null)
    const { data, error } = await twoFactor.enable({ password })
    if (error || !data) {
      setError("Wrong password")
      return
    }
    setQr(await QRCode.toDataURL(data.totpURI))
    setBackupCodes(data.backupCodes)
  }

  async function verify() {
    setError(null)
    const { error } = await twoFactor.verifyTotp({ code })
    if (error) {
      setError("Invalid code")
      return
    }
    setDone(true)
  }

  if (done) return <p className="text-sm text-muted-foreground">Two-factor is enabled.</p>

  return (
    <div className="space-y-4">
      {!qr ? (
        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your password"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <Button onClick={enable}>Enable two-factor</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR is a local data URI, next/image adds nothing */}
          <img src={qr} alt="Scan with your authenticator app" className="h-40 w-40" />
          <div className="text-xs">
            <p className="font-medium">Backup codes (save these once):</p>
            <ul className="grid grid-cols-2 gap-1 font-mono">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <Button onClick={verify}>Verify and finish</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Mount it on the settings/setup page**

In `src/app/(dashboard)/setup/page.tsx`, read the session, then render `<TwoFactorSetup enabled={session.user.twoFactorEnabled ?? false} />` inside a security section. Import the component at the top.

- [ ] **Step 4: Manual smoke of enrollment**

Run: `npm run dev`, sign in, open the setup page, enable two-factor, scan the QR in an authenticator app, enter the code.
Expected: "Two-factor is enabled." Next login prompts for the code.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint -- --max-warnings 0`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/TwoFactorSetup.tsx "src/app/(dashboard)/setup/page.tsx" package.json package-lock.json
git commit -m "feat: totp enrollment with backup codes"
```

---

### Task 8: Per-company policy and server-side enforcement

**Files:**
- Create: `src/app/api/company/auth-policy/route.ts`
- Create: `src/app/api/company/auth-policy/route.test.ts`
- Create: `src/components/settings/AuthPolicySettings.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (enforce enrollment when the company requires 2FA)

**Interfaces:**
- Consumes: `requireAdmin` / `requireAuth` from `src/lib/apiAuth`, `prisma`, `getSession`.
- Produces: `PATCH /api/company/auth-policy` updating `require2fa` and `allowedAuthMethods`, scoped to the caller's company.

- [ ] **Step 1: Write the failing policy-route test**

Create `src/app/api/company/auth-policy/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const requireAdmin = vi.fn()
const update = vi.fn()

vi.mock("@/lib/apiAuth", () => ({ requireAdmin: () => requireAdmin() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { company: { update: (a: unknown) => update(a) } },
}))

import { PATCH } from "./route"

function patch(body: unknown): Request {
  return new Request("http://localhost/api/company/auth-policy", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ session: { user: { companyId: "co1" } }, error: null })
})

describe("PATCH /api/company/auth-policy", () => {
  it("rejects an unknown method", async () => {
    const res = await PATCH(patch({ allowedAuthMethods: ["SMS"] }))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("updates the policy scoped to the caller's company", async () => {
    const out = await PATCH(patch({ require2fa: true, allowedAuthMethods: ["TOTP"] }))
    expect(out.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      where: { id: "co1" },
      data: { require2fa: true, allowedAuthMethods: ["TOTP"] },
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/company/auth-policy/route.test.ts`
Expected: FAIL ("Cannot find module ./route").

- [ ] **Step 3: Implement the route**

Create `src/app/api/company/auth-policy/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

const METHODS = new Set(["TOTP", "EMAIL_OTP", "PASSKEY"])

export async function PATCH(req: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const body = (await req.json()) as {
    require2fa?: boolean
    allowedAuthMethods?: string[]
  }

  const data: { require2fa?: boolean; allowedAuthMethods?: string[] } = {}

  if (typeof body.require2fa === "boolean") data.require2fa = body.require2fa

  if (body.allowedAuthMethods) {
    if (!body.allowedAuthMethods.every((m) => METHODS.has(m))) {
      return NextResponse.json({ error: "Unknown method" }, { status: 400 })
    }
    data.allowedAuthMethods = body.allowedAuthMethods
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  await prisma.company.update({ where: { id: session.user.companyId }, data })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/company/auth-policy/route.test.ts`
Expected: PASS

- [ ] **Step 5: Write the admin settings component**

Create `src/components/settings/AuthPolicySettings.tsx`, a client component with a `require2fa` toggle and method checkboxes that PATCHes `/api/company/auth-policy`. Follow the pattern of the existing `RemediationSettings.tsx` for fetch + optimistic UI. Render it (admin-only) on the settings/setup page.

- [ ] **Step 6: Enforce enrollment in the dashboard layout**

In `src/app/(dashboard)/layout.tsx`, after reading the session, load the company policy and redirect to the setup page when 2FA is required but not yet enrolled:

```typescript
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
// ...after: const session = await getSession()
if (!session) redirect("/login")
const company = await prisma.company.findUnique({
  where: { id: session.user.companyId },
  select: { require2fa: true },
})
if (company?.require2fa && !session.user.twoFactorEnabled) {
  redirect("/setup?enroll=2fa")
}
```

Ensure the setup page itself is reachable while enrolling (the redirect targets it, so it renders normally).

- [ ] **Step 7: Type-check, lint, and run the auth tests**

Run: `npx tsc --noEmit && npm run lint -- --max-warnings 0 && npx vitest run src/app/api src/lib/auth`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/api/company/auth-policy src/components/settings/AuthPolicySettings.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "feat: per-company auth policy with 2fa enforcement"
```

---

### Task 9: Types cleanup and next-auth removal

**Files:**
- Delete: `src/types/next-auth.d.ts`
- Modify: `package.json` (remove `next-auth`)
- Modify: any remaining file flagged by grep

**Interfaces:**
- Produces: no ambient next-auth module augmentation; session/user types inferred from Better Auth.

- [ ] **Step 1: Delete the augmentation file**

Run: `git rm src/types/next-auth.d.ts`

- [ ] **Step 2: Remove the dependency**

Run: `npm uninstall next-auth`
Expected: `next-auth` gone from `package.json`.

- [ ] **Step 3: Confirm no references remain**

Run: `grep -rn "next-auth\|@auth/core\|@/auth\"\|@/auth.config" src`
Expected: no matches.

- [ ] **Step 4: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If any file referenced the `Session` type from `next-auth`, replace it with `Awaited<ReturnType<typeof getSession>>` imported from `@/lib/auth/session`.

- [ ] **Step 5: Commit**

```bash
git add src/types package.json package-lock.json
git commit -m "chore: remove next-auth"
```

---

### Task 10: End-to-end smoke and final gates

**Files:**
- Modify: `e2e/smoke.spec.ts` (login flow if it references next-auth internals)
- Modify: `e2e/seed.ts` (if it seeds a user password directly)

**Interfaces:**
- Consumes: the running app with a seeded admin.

- [ ] **Step 1: Update the e2e seed if needed**

If `e2e/seed.ts` sets `hashedPassword` on a user, switch it to the user-plus-`account` pattern from Task 2 Step 7. If it calls the shared `prisma/seed.ts`, no change.

- [ ] **Step 2: Check the smoke login step**

In `e2e/smoke.spec.ts`, confirm the login step fills the email/password form and submits. The Better Auth form uses the same field names (`email`, `password`), so the selectors should still match. Update any assertion that depended on a next-auth redirect URL (`/api/auth/...`).

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: the smoke test passes (login, dashboard loads).

- [ ] **Step 4: Run all unit tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Full gate sweep**

Run: `npm run lint -- --max-warnings 0 && npx tsc --noEmit && npx prisma validate && npm run build`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test: cover better-auth login in e2e smoke"
```

---

## Self-Review Notes

- Spec section 1 (architecture): Tasks 1, 3, 4, 5 cover server instance, session helper, handler/middleware, page swap.
- Spec section 2 (schema + data migration): Task 2, including the bcrypt-preserving backfill and seed updates.
- Spec section 3 (DB sessions): Task 2 (Session table) + Task 4 (cookie-based middleware).
- Spec section 4 (2FA flow): Tasks 6 (login challenge), 7 (enrollment), 8 (per-company enforcement).
- Spec section 5 (types, security, rate limiting): Task 1 (additionalFields, bcrypt), Task 9 (types), rate limiting is inherited from Better Auth defaults (no custom code, so no task).
- Spec section 6 (tests and gates): Tasks 3, 8 (unit), Task 10 (e2e + gates).
- Non-goals (email OTP, passkeys, session UI): correctly absent; schema leaves `EMAIL_OTP` / `PASSKEY` in the enum for later.
