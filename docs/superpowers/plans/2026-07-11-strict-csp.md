# Strict CSP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforcing strict CSP with per-request nonces on every HTML page, including `/login`, without breaking auth, hydration, or client-side PDF export.

**Architecture:** Pure `buildCsp(nonce, dev)` in `src/lib/csp.ts` (vitest-covered); `src/middleware.ts` generates the nonce, forwards it via request headers (Next applies it to its inline scripts), sets the response CSP, and keeps the `auth()` wrapper; matcher widened to cover `/login`, with `authorized` updated to allow it.

**Tech Stack:** Next.js 15 App Router middleware (edge runtime), next-auth v5 wrapper, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-strict-csp-design.md`. Branch: `feat/strict-csp`.
- ASCII only. No code comments unless the WHY is non-obvious.
- Test imports: `import { describe, it, expect } from "vitest"` (repo style).
- `next.config.ts` stays untouched.
- Gates: `npm run lint -- --max-warnings 0`, `npx tsc --noEmit`, `npm test`.

---

### Task 1: buildCsp pure function (TDD)

**Files:**
- Create: `src/lib/csp.ts`
- Test: `src/lib/csp.test.ts`

**Interfaces:**
- Produces: `buildCsp(nonce: string, dev: boolean): string`, consumed by Task 2.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest"
import { buildCsp } from "./csp"

describe("buildCsp", () => {
  it("embeds the nonce in script-src with strict-dynamic", () => {
    const csp = buildCsp("abc123", false)
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
  })

  it("omits dev-only sources in production", () => {
    const csp = buildCsp("abc123", false)
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).not.toContain("ws:")
  })

  it("adds unsafe-eval and ws: in development", () => {
    const csp = buildCsp("abc123", true)
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain("connect-src 'self' ws:")
  })

  it("locks down framing and object sources", () => {
    const csp = buildCsp("abc123", false)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/csp.test.ts`
Expected: FAIL, cannot resolve `./csp`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildCsp(nonce: string, dev: boolean): string {
  const script = `'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`
  const connect = `'self'${dev ? " ws:" : ""}`
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/csp.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csp.ts src/lib/csp.test.ts
git commit -m "feat: add buildCsp directive builder"
```

### Task 2: Middleware nonce wiring and login allowance

**Files:**
- Modify: `src/middleware.ts` (whole file, currently 8 lines)
- Modify: `src/auth.config.ts:7-9` (`authorized` callback)

**Interfaces:**
- Consumes: `buildCsp(nonce: string, dev: boolean): string` from Task 1.
- Produces: enforcing `Content-Security-Policy` response header on all matched pages; `x-nonce` request header available to server components if ever needed.

- [ ] **Step 1: Replace `src/middleware.ts`**

```ts
import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"
import { buildCsp } from "@/lib/csp"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development")

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set("Content-Security-Policy", csp)
  return res
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\..*).*)"],
}
```

The CSP goes on the request headers too: that is how Next.js detects the
nonce and stamps it on its own inline scripts.

- [ ] **Step 2: Allow `/login` in `src/auth.config.ts`**

Replace:

```ts
    authorized({ auth }) {
      return !!auth?.user
    },
```

with:

```ts
    authorized({ auth, request }) {
      if (request.nextUrl.pathname.startsWith("/login")) return true
      return !!auth?.user
    },
```

Without this, the widened matcher sends logged-out visitors of `/login`
into a redirect loop.

- [ ] **Step 3: Gates**

Run: `npm run lint -- --max-warnings 0 && npx tsc --noEmit && npm test`
Expected: clean, 152 tests (148 + 4 new).

- [ ] **Step 4: Header check against the dev stack**

With the compose stack up (volume-mounted, HMR picks the change):

Run: `curl -sI http://localhost:3000/login | grep -i content-security-policy`
Expected: one `content-security-policy` line containing `'nonce-` and
`'strict-dynamic'` plus dev-only `'unsafe-eval'` and `ws:`.

Run twice; the nonce must differ between requests.

Run: `curl -sI http://localhost:3000/api/health | grep -ci content-security-policy`
Expected: `0` (API routes excluded).

Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/`
Expected: `307 http://localhost:3000/login...` (auth redirect intact).

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/auth.config.ts
git commit -m "feat: enforce strict CSP with per-request nonce"
```

### Task 3: Documentation

**Files:**
- Modify: `docs/production-readiness.md` (headers row, headers section, remaining list)

- [ ] **Step 1: Update the checklist row**

Replace:

```markdown
| Security headers review | Done (baseline) | See below; strict CSP still pending. |
```

with:

```markdown
| Security headers review | Done | Baseline headers plus enforcing strict CSP with per-request nonces; see below. |
```

- [ ] **Step 2: Update the headers section**

Replace the paragraph:

```markdown
Pending: a strict `Content-Security-Policy`. The App Router needs per-request
nonces for inline scripts/styles, so it is tracked as a follow-up rather than
shipped loose.
```

with:

```markdown
A strict `Content-Security-Policy` is enforced by `src/middleware.ts`:
per-request nonce with `strict-dynamic` for scripts, `'self'` defaults,
`frame-ancestors 'none'`. Styles allow `'unsafe-inline'` (Tailwind and chart
libraries); the directive string is built by `src/lib/csp.ts`.
```

- [ ] **Step 3: Trim the remaining list**

Delete the line `- Strict CSP with nonces.` from "Remaining before removing
the WIP banner".

- [ ] **Step 4: Commit**

```bash
git add docs/production-readiness.md
git commit -m "docs: mark strict CSP as done"
```

### Task 4: Manual browser verification

**Files:** none.

- [ ] **Step 1: User click-through**

Ask the user to browse the running app (login, dashboard, alerts, reports
including PDF export, settings, employees) with the browser console open.
Expected: zero CSP violation messages. If a violation appears (likely
`worker-src` or `img-src` from a client library), capture the exact console
line and adjust the corresponding directive in `src/lib/csp.ts` plus its
test, then re-run gates and amend with a fix commit.
