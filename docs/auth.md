# Auth.js (next-auth v5 beta) dependency choice

Authentication uses Auth.js `next-auth@5.0.0-beta.31`, pinned to the exact
version (no `^` range).

## Why a beta

- v5 is the App Router-native line. The stable v4 targets the Pages Router
  era and is in maintenance; this project is App Router only.
- The v5 beta is widely deployed in production across the ecosystem and has
  been the documented default for new App Router projects for a long time.

## Risk and mitigation

The real risk of a beta is a breaking change landing between beta releases
through an unreviewed dependency bump. Mitigations:

- The version is pinned exactly. Dependabot still opens update PRs, but each
  one changes the pin explicitly and gets reviewed; nothing moves silently.
- Auth flows are exercised by the seeded admin login during manual checks.

## Migration plan to stable

When v5 stable ships:

1. Read the official migration notes for changes since the pinned beta.
2. Bump the pin to the stable version in a dedicated PR.
3. Verify login, session handling, and the middleware matcher still behave.
4. After one stable release cycle without issues, a caret range may be
   restored; keeping the exact pin is also fine.
