# E2E smoke test - design

Date: 2026-07-11. Roadmap V1 step 4: one minimal end-to-end test that proves
login, dashboard, and alerts work in a real browser, wired as a blocking CI
gate.

## Goal

Catch the regressions unit tests cannot see (auth flow, middleware, CSP,
hydration) with a single stable spec. Deliberately minimal: one spec file,
one browser (chromium). Broader coverage is v1.1 territory.

## Decisions

- Tool: `@playwright/test` (devDependency), chromium only.
- One spec, `e2e/smoke.spec.ts`: sign in with the seeded admin
  (`admin@datashield.local` / `ChangeMe123!`), assert the dashboard renders,
  navigate to the alerts page, assert it renders.
- The spec collects browser console messages and fails on any CSP violation
  (`Refused to` / `Content Security Policy`), so the strict CSP from step 2
  stays continuously verified.
- `playwright.config.ts`: `testDir: "e2e"`, `baseURL`
  `http://localhost:3000`, `webServer` runs `npm run start` with
  `reuseExistingServer: !process.env.CI` (locally it reuses the running
  compose stack; in CI it starts the built app).
- CI: new `e2e` job (postgres:16 service, migrate, seed, build, playwright
  install chromium, run tests), added to the aggregate `ci` job's `needs`,
  so it blocks merges like the other gates.
- Vitest is untouched: its include is `src/**/*.test.ts`, the e2e dir uses
  `.spec.ts`.
- Stable selectors: `getByLabel("Email")`, `getByLabel("Password")`,
  `getByRole("button", { name: "Sign in" })` (labels exist in
  `src/app/(auth)/login/page.tsx`).

## Files

| File | Change |
| --- | --- |
| `playwright.config.ts` | New. testDir, baseURL, webServer, chromium project. |
| `e2e/smoke.spec.ts` | New. The smoke spec with CSP console guard. |
| `package.json` | devDependency `@playwright/test`; script `test:e2e`. |
| `Makefile` | `e2e` target. |
| `.gitignore` | `playwright-report/`, `test-results/`. |
| `.github/workflows/ci.yml` | New `e2e` job; aggregate `ci` needs it. |

## Error handling

None custom; Playwright reports failures with traces
(`trace: "on-first-retry"`).

## Verification

- Local: `npx playwright test` against the running compose stack, 1 spec
  green.
- Gates: lint, tsc (playwright config and spec are type-checked), vitest
  count unchanged.
- CI: the `e2e` job goes green on the final push (verified at the end of
  the roadmap since nothing is pushed before then).
