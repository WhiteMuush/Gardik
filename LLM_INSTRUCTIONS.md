# LLM Instructions for DataShield

**This file is mandatory reading before any action on this codebase.**
**If you have not read this file in full, you are not authorized to touch a single line.**

These rules are not advisory. They are enforced by Git hooks and CI (see section 12).
A commit that violates them is rejected automatically. Do not try to bypass the gate.

---

## 0. Prime directive

Do exactly what is asked. Nothing more. No cleanup, no refactor, no "while I'm here"
improvements, no unsolicited additions. If the request is ambiguous, stop and ask before
writing a single character.

---

## 1. Hard stops, never do these under any circumstances

- **NEVER push directly to `main`.** The branch is protected. Any direct push is rejected.
  Always work on a dedicated branch and open a PR.
- **NEVER merge a PR without explicit user approval.** You may create the PR, not merge it.
- **NEVER add `Co-Authored-By`, `Co-authored-by`, or any trailer attributing the commit to
  an AI.** Commits have one author: the human contributor.
- **NEVER bypass the hooks** with `git commit --no-verify`, `-n`, or by unsetting
  `core.hooksPath`. The same checks run in CI, so a bypass only delays the rejection.
- **NEVER upgrade a major dependency version.** Frozen until an explicit migration task:
  Next.js (^15), Tailwind CSS (^3), TypeScript (^5), ESLint (^9). Dependabot PRs for these
  must not be merged.
- **NEVER modify `prisma/schema.prisma` and apply changes without `prisma migrate dev`.**
  Schema drift without a migration file is forbidden.
- **NEVER write raw SQL** outside Prisma migration files. All database access goes through
  the Prisma client. `$queryRawUnsafe` and `$executeRawUnsafe` are forbidden.
- **NEVER commit secrets, API keys, tokens, or credentials.** All secrets belong in
  `.env.local`, which is gitignored. Only `.env.example` may be committed. If you spot a
  secret in a diff, stop immediately and report it.
- **NEVER write user-facing text, code comments, variable names, or file names in French or
  any language other than English.** Every versioned artifact is English-only. No accented
  characters. No em dash, use a comma instead.
- **NEVER delete or overwrite uncommitted work without explicit instruction.**
- **NEVER run `git push --force` or `git reset --hard` without explicit user instruction.**

---

## 2. Git and branch rules

**Branch naming:**
```
feat/<short-description>
fix/<short-description>
chore/<short-description>
docs/<short-description>
refactor/<short-description>
```

**Commit message format (Conventional Commits, mandatory):**
```
<type>(<optional-scope>): <description in lowercase>
```
Types: `feat`, `fix`, `chore`, `docs`, `refactor`. No other types. No period at the end.
No emoji. No AI attribution. Header limited to 72 characters.

**Before any commit (the hook does this for you, do not skip it):**
1. Run `npm run lint`, zero warnings allowed, zero errors allowed.
2. Verify no English-only rule is violated.
3. Verify no secret is staged.

**PR rules:**
- One feature or fix per PR, no bundling unrelated changes.
- PR title must follow Conventional Commits format.
- Reference any related issue with `Closes #N`.

---

## 3. Code architecture rules

**These are constraints, not suggestions.**

| Rule | Limit |
|---|---|
| Lines per function | 20-30 maximum |
| Lines per file | 150-200 maximum, split into modules when reached |
| Responsibilities per function | Exactly one |

**File structure:**
- `src/app/`, Next.js App Router pages and API routes only. No business logic.
- `src/components/`, React components only. No direct Prisma calls.
- `src/lib/`, all business logic, service functions, and utilities.
- `src/hooks/`, React hooks only.
- `src/contexts/`, React context providers only.
- `src/types/`, TypeScript type definitions only.

**Crossing these boundaries is forbidden.** A component does not import Prisma. A lib file
does not import React. An API route does not contain business logic, it calls a lib function.

---

## 4. TypeScript rules

- The project runs in **strict mode**. `tsconfig.json` must not be loosened.
- `any` is forbidden unless accompanied by an explicit `// eslint-disable` with a written
  justification in the same commit message.
- All exported functions must have explicit return types.
- `as unknown as X` double casts are forbidden.
- `@ts-nocheck` is forbidden. `@ts-ignore` is discouraged, prefer `@ts-expect-error`.
- `console.log` must not ship in application code (allowed only in seed and script files).

---

## 5. Widget system rules

Every dashboard widget component **must** follow this exact structure or it breaks resize:

```tsx
// Outer wrapper: h-full flex flex-col
<div className="h-full flex flex-col p-4">
  {/* Header: shrink-0, never grows */}
  <div className="shrink-0 mb-2">
    <h3>Title</h3>
  </div>
  {/* Content area: flex-1 min-h-0, takes remaining space */}
  <div className="flex-1 min-h-0">
    {/* Recharts ResponsiveContainer: always height="100%" */}
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} />
    </ResponsiveContainer>
  </div>
</div>
```

**Violations:**
- Missing `h-full` on the wrapper breaks the widget height.
- Missing `flex-1 min-h-0` on the content area makes the chart collapse.
- `ResponsiveContainer` with a fixed pixel height breaks responsive resize.
- **These are functional requirements, not style preferences.**

**Adding a new widget requires all of the following:**
1. A component file in `src/components/dashboard/`.
2. An entry in `src/lib/widgetRegistry.ts` with `type`, `defaultTitle`, `description`,
   `defaultSize`, `minSize`, `category`, and `defaultVisible`.
3. A case in the widget renderer in `src/app/(dashboard)/dashboard/page.tsx`.
4. `defaultVisible: false` on any new widget, it must not appear by default.

---

## 6. Dashboard persistence rules

- **Dashboard layout and widget config are only written to the database when the user is in
  Customize mode (`editing === true` in `DashboardEditContext`).**
- `onLayoutChange` must never persist data when `editing` is false.
- The `static` property on grid items must never be conditionally tied to `editing`. Static
  means permanently locked, not "locked when not editing".
- Never add a DB write to any dashboard code path that runs outside the explicit save action.

---

## 7. Database and Prisma rules

- All schema changes go through `prisma migrate dev --name <descriptive-name>`. Never skip it.
- Migration file names must be descriptive: `add_alert_status_index`, not `migration1`.
- Never use `prisma db push` in a context that bypasses migration history.
- The `prisma generate` postinstall hook runs automatically, do not run it manually.
- Cascade rules (`onDelete: Cascade`, `onDelete: SetNull`) are intentional. Do not change
  them without understanding the full data model impact.

---

## 8. Authentication and security rules

- All API routes under `src/app/api/` must validate the session with Auth.js before
  processing any request. No unauthenticated endpoints except `/api/auth/`.
- SCIM endpoints (`/api/scim/`) use token-based auth via `src/lib/directory/scim-auth.ts`,
  do not add session-based auth on top of them.
- The `DIRECTORY_ENCRYPTION_KEY` variable is required for all directory operations. The app
  refuses to run without it. Do not add fallback values.
- Never log decrypted credentials or API keys. Use the `keyHint` field for partial key info.
- Validate all user inputs at API boundaries. Never trust a client-provided `companyId`
  without verifying it matches the authenticated user's company.
- All external API calls (HIBP, DeHashed, LeakCheck, IntelX, Snusbase) go through
  `src/lib/scan/providers/`, never call them directly from a component or API route.

---

## 9. Dependency rules

- **Do not add a new dependency without explicit user approval.** Propose it, wait, then add.
- **Do not remove a dependency** without verifying nothing imports it (`grep -r` first).
- The `overrides` block in `package.json` (`postcss`, `@hono/node-server`) fixes audit
  vulnerabilities. Do not remove these overrides.
- `tw-animate-css` is a runtime CSS dependency imported in `globals.css`. It cannot be moved
  to devDependencies.
- Dev server: use `npm run dev` as defined in `package.json`.

---

## 10. Environment and configuration

- `.env.local` is gitignored and must remain so.
- Required variables: `DATABASE_URL`, `DIRECTORY_ENCRYPTION_KEY`, `AUTH_SECRET`.
- Optional variables with functional impact: `HIBP_API_KEY` (disables HIBP scans if absent).
- Never hardcode environment-specific values in source files.

---

## 11. When uncertain, mandatory protocol

If you are unsure about any of the following, **stop and ask**:
- Whether a change falls within the scope of the request.
- Whether a schema change requires a migration.
- Whether a new file violates the architecture boundaries.
- Whether an existing test or CI step covers the change.
- Whether a dependency conflict exists.

**Do not assume. Do not guess. Do not proceed.**

The cost of asking is zero. The cost of a wrong assumption in a security-focused codebase
is not.

---

## 12. Enforcement (this is how the rules are applied, not optional)

The rules above are enforced mechanically. They run the same checks in two places, so they
cannot be skipped by any contributor or AI.

**Local Git hooks** (`.githooks/`, activated by `core.hooksPath`, set automatically by the
`prepare` npm script on `npm install`):
- `commit-msg`: validates Conventional Commits format and rejects AI attribution and
  non-ASCII characters in the message.
- `pre-commit`: runs `npm run lint` and the full content checks on staged changes.

**CI** (`.github/workflows/compliance.yml`, runs on every PR to `main`):
- Validates every commit message in the PR.
- Re-runs the exact same content and dependency checks on the PR diff.

**What the checks block** (only on added lines, pre-existing code is not penalized):
- AI attribution markers in commit messages and code.
- Commit messages that are not valid Conventional Commits.
- Secrets and credential files (only `.env.example` is allowed).
- Non-English (accented) characters and em dashes.
- Major bumps of frozen dependencies (Next, Tailwind, TypeScript, ESLint).
- `as unknown as`, `@ts-nocheck`, `console.log`, `prisma db push`, unsafe raw SQL.
- Any lint error or warning.

**Shared check scripts** live in `.githooks/lib/` and are the single source of truth, used by
both the hooks and CI. Do not weaken, disable, or special-case them to get a commit through.

**Required status check:** the `compliance` job must be added to the `main` branch ruleset as
a required check, alongside the existing `ci` check, so a red compliance run blocks merging.
