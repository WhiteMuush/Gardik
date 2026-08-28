# Hiding entry points a role cannot use

## Problem

A role that lacks a permission is correctly refused when it reaches the target,
but the interface keeps offering the way in. Typing `/employees` with a role
holding only `dashboard:read` renders `NoAccess`, which is the intended
behaviour. Clicking a button that leads to the same refusal is not: the user is
told to ask an administrator for something the interface just invited them to
do.

Two families of dead-end affordances exist today.

**Links to permission-gated pages.** `SetupChecklist` offers three of them
(`/data-sources`, `/data-api`, `/employees`) on `/setup`, a page mapped to
`AUTH_ONLY` and therefore reachable by every signed-in user. `/dashboard`
redirects to `/setup` when the company has neither an employee nor an API key,
so a low-permission user of a fresh tenant lands directly on three refusals.
`DashboardCanvas` offers a fourth (`/dashboard/widgets`, gated by
`dashboard:customize`) once Customize mode is open, and `WidgetLibrary` offers a
fifth (`/dashboard`, gated by `dashboard:read`).

**Links to permission-gated API routes.** `ReportToolbar` renders CSV and PDF
buttons pointing at `/api/reports/export`, which enforces `reports:export`. The
component receives no permission at all, so anyone holding `reports:read` sees
both buttons and receives a 403. `ExposureRegister` renders an evidence download
pointing at `/api/register/[id]/evidence`, which enforces `register:evidence`.
That link sits outside the component's `isAdmin` block, and the block's
`isAdmin` is derived from `register:manage` in any case, a different permission.

A third defect belongs to the same story. `DashboardCanvas` decides which preset
controls to show with `userRole === ADMINISTRATOR`, a comparison on a role
*name*. The server decides the same question with the `dashboard:manage_shared`
*permission*, in `api/dashboard/presets/route.ts` and
`api/dashboard/presets/[id]/route.ts`. The two disagree in both directions: a
custom role granted the permission is denied the control the API would accept,
and a role merely named "Administrator" is shown a control the API refuses.

## What this is not

This is not a security fix, and it must not be described as one. The
authorization boundary lives on the server, and it is already correct:
`guardPage` refuses the page before it queries anything, `requirePermission`
refuses the API, and the preset routes check `dashboard:manage_shared`
themselves. Hiding a button protects nothing, because anyone can type the URL.

What the work buys is a coherent interface and, through the test below,
resistance to the same omission recurring. The failure being prevented is a
future contributor adding a sixth link without noticing.

## Design

### A single helper for the visible page set

`(dashboard)/layout.tsx` computes the set of pages the caller may open as an
inline expression over `PAGE_PERMISSIONS`. Extract it into
`src/lib/rbac/page-permissions.ts`:

```ts
export function visiblePages(perms: ReadonlySet<string>): string[]
```

It returns the declared paths whose permission the holder satisfies, treating
`AUTH_ONLY` as always satisfied. The layout calls it instead of restating it, so
the rule has one definition and one set of tests.

### One prop contract for page links: `visible: string[]`

`Sidebar` already takes this prop, and its doc comment already states the reason:
a client component cannot be trusted with the decision, and a second copy of the
rule would drift. Extend the same contract, unchanged in shape and meaning, to
the three other components that render links to gated pages. Each receives the
list from its own server page and filters with `visible.includes(href)`.

| Component | Server page | Links gated |
| --- | --- | --- |
| `SetupChecklist` | `(dashboard)/setup/page.tsx` | `/data-sources`, `/data-api`, `/employees` |
| `DashboardCanvas` | `(dashboard)/dashboard/page.tsx` | `/dashboard/widgets` |
| `WidgetLibrary` | `(dashboard)/dashboard/widgets/page.tsx` | `/dashboard` |

In `SetupChecklist` the step itself stays visible with its title and
description, and only its call-to-action link disappears. A low-permission user
should still understand what the company is missing; the existing note "Data
sources and API keys are managed by admins" then reads as the explanation it was
always meant to be. Removing the whole step would leave that user an almost
empty page with nothing accounting for it.

### Explicit booleans for API-backed actions

Links to API routes are not page navigation, so `PAGE_PERMISSIONS` and `visible`
do not apply to them. Those components receive a named boolean instead, computed
by their server page from the same permission the route enforces:

| Component | Server page | Prop | Mirrors |
| --- | --- | --- | --- |
| `ReportToolbar` | `(dashboard)/reports/page.tsx` | `canExport` | `reports:export` |
| `ExposureRegister` | `(dashboard)/register/page.tsx` | `canDownloadEvidence` | `register:evidence` |

When the boolean is false the button is not rendered. `ExposureRegister` already
takes an `isAdmin` prop for `register:manage`; the new prop sits beside it rather
than replacing it, because they answer different questions.

### Role name replaced by permission

In `DashboardCanvas`, the `userRole: string` prop becomes
`canManageShared: boolean`, derived from `dashboard:manage_shared` by
`dashboard/page.tsx`. The internal `isAdmin` binding is replaced by that prop
throughout, so the client mirrors the server rule instead of guessing at it. The
`VIEWER_ROLE` import in `dashboard/page.tsx` becomes unused and goes with it.

### The regression test

Add `src/lib/rbac/link-coverage.test.ts`, modelled on the existing
`route-coverage.test.ts`, which already exists in this repository to fail the
build when a contributor forgets to declare a route.

The test walks every `.tsx` file under `src` and looks for **quoted string
literals** equal to a declared path. Matching the literal rather than an
`href="..."` attribute is deliberate and load-bearing: `SetupChecklist` writes
`href={step.href}` and keeps its paths in an object several lines above, so an
attribute-shaped pattern would have missed the very file that motivated this
work.

Two assertions:

1. A file containing a literal equal to a `PAGE_PERMISSIONS` path gated by a
   real permission must also contain `visible.includes(`. Paths mapped to
   `AUTH_ONLY` are ignored, since every signed-in user may open them.
2. A file containing a literal path under `/api/` that resolves to a
   `ROUTE_PERMISSIONS` entry gated by a real permission must be declared in a
   map, `API_LINK_PERMISSIONS`, naming the permission the component gates on.
   An undeclared file fails the build.

The second assertion is a hand-maintained inventory rather than a mechanical
proof, exactly as `ROUTE_PERMISSIONS` itself is. That is the point: it does not
verify the gate is correct, it forces the decision to be made consciously and
recorded.

Both assertions share the same documented limit, and the test says so in a
comment: they prove the file received the means to gate, not that it gated the
right target. They catch the omission, which is the failure that actually
happens.

## Out of scope

**Post-login landing.** `(auth)/login/page.tsx` and `app/page.tsx` both send the
user to `/dashboard`, which is gated by `dashboard:read`. A role without it sees
a refusal as its first screen after signing in. This is the same family of
defect but a different fix: a redirect to recompute rather than an affordance to
hide. It gets its own branch so that neither review has to hold both ideas at
once.

**The read-only route coverage gap.** `route-coverage.test.ts` only inspects
mutating handlers, so a GET-only route can ship unregistered. Two exist today
(`audit`, `register/[id]/evidence`); both enforce their permission correctly, so
nothing is exposed, but nothing would catch a third that did not. That one does
touch a real guard and is tracked separately.

## Testing

Test-first, in this order.

1. `link-coverage.test.ts` goes red, naming `SetupChecklist`,
   `DashboardCanvas`, `WidgetLibrary`, `ReportToolbar` and `ExposureRegister`.
   `Sidebar` passes from the start, since it already contains the expression.
2. `visiblePages` tests are added to `page-permissions.test.ts` and go red:
   empty permission set yields only the `AUTH_ONLY` paths; a set holding one
   permission yields that path plus the `AUTH_ONLY` ones; an unknown permission
   yields nothing extra.
3. Implement in order: helper, layout refactor, the three page-link components,
   the two API-link components, the `userRole` swap. Tests go green.
4. Full gates: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`.
5. Manual check against the `Test Minimal` role (`dashboard:read` only) that
   currently exists in the development database: `/setup` shows its three steps
   with no call-to-action links, and `/dashboard` still opens.

## Files touched

- `src/lib/rbac/page-permissions.ts` (add `visiblePages`)
- `src/lib/rbac/page-permissions.test.ts` (cover it)
- `src/lib/rbac/link-coverage.test.ts` (new)
- `src/app/(dashboard)/layout.tsx` (call the helper)
- `src/app/(dashboard)/setup/page.tsx`, `src/components/dashboard/SetupChecklist.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/DashboardCanvas.tsx`
- `src/app/(dashboard)/dashboard/widgets/page.tsx`, `src/components/dashboard/WidgetLibrary.tsx`
- `src/app/(dashboard)/reports/page.tsx`, `src/components/reports/ReportToolbar.tsx`
- `src/app/(dashboard)/register/page.tsx`, `src/components/register/ExposureRegister.tsx`
