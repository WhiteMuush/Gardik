<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./assets/banner-light.png">
  <img src="./assets/banner-light.png" alt="Gardik. Know what leaked. Without leaking more." width="100%">
</picture>

**Know what leaked. Without leaking more.**

<!-- CI -->
[![CI](https://github.com/WhiteMuush/Gardik/actions/workflows/ci.yml/badge.svg)](https://github.com/WhiteMuush/Gardik/actions/workflows/ci.yml)
[![Security](https://github.com/WhiteMuush/Gardik/actions/workflows/security.yml/badge.svg)](https://github.com/WhiteMuush/Gardik/actions/workflows/security.yml)
[![Compliance](https://github.com/WhiteMuush/Gardik/actions/workflows/compliance.yml/badge.svg)](https://github.com/WhiteMuush/Gardik/actions/workflows/compliance.yml)
[![CodeQL](https://github.com/WhiteMuush/Gardik/actions/workflows/codeql.yml/badge.svg)](https://github.com/WhiteMuush/Gardik/actions/workflows/codeql.yml)

<!-- Stack -->
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%207-4169e1?logo=postgresql&logoColor=white)
![Self-hosted](https://img.shields.io/badge/deployment-self--hosted-2ea44f)

[Live demo](https://gardik.melvinpetit.com) (read only, no signup)

</div>

Your company knows exactly how many laptops it owns. It does not know how many
of its employees have a password in circulation.

Gardik is a self-hosted service that answers that question continuously. It
syncs your existing directory, checks every employee against known breach
sources, and turns the result into a prioritized, auditable view of who is
exposed and how badly.

## Status

v1.2.3. The production readiness checklist is tracked in
[docs/production-readiness.md](docs/production-readiness.md).

## Features

### Exposure monitoring

- Continuous per-employee breach monitoring, not one-off lookups on a single
  address
- Six breach sources: Have I Been Pwned (including stealer logs), DeHashed,
  Intelligence X, LeakCheck and Snusbase
- Severity-based alerting with assignment, status workflow, comments and
  remediation tracking

### Directory sync

Your directory stays the source of truth, so you never retype your headcount.
Six connectors, in [`src/lib/directory`](src/lib/directory):

| Connector | Source |
| --- | --- |
| Microsoft Entra ID (Azure AD) | `azure.ts` |
| Google Workspace | `google.ts` |
| LDAP / Active Directory | `ldap.ts` |
| Okta | `okta.ts` |
| AWS IAM Identity Center | `aws.ts` |
| Inbound SCIM 2.0 | `scim-auth.ts` |

Connector credentials are encrypted at rest. See
[docs/encryption.md](docs/encryption.md).

### Dashboard

- 20 widgets, drag and drop, with saved presets and dashboards shared across
  teams (see [`src/lib/widgetRegistry.ts`](src/lib/widgetRegistry.ts))
- Breakdowns by severity, department, breach source, data type and trend over
  time

### Compliance and reporting

- GDPR exposure register with evidence attachments
- Scheduled reports in PDF, CSV and HTML
- Full audit log

### Integrations

- SIEM export to feed your SOC
- Outbound webhooks to your own tooling
- Data API with scoped credentials

### Access control

- Better Auth with SSO (OIDC), passkeys and TOTP two-factor
- RBAC over a fixed vocabulary of 36 permissions, with role presets, step-up
  authentication on sensitive actions and last-admin protection
- Details in [docs/auth.md](docs/auth.md)

## Privacy model

Gardik is self-hosted on purpose. Your employee data stays on your
infrastructure, directory credentials are encrypted at rest, and the only
outbound requests are the ones you configure. Nothing reports back to the
author.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript in strict mode
- Prisma 7 with PostgreSQL
- Better Auth (SSO, passkeys, TOTP)
- Tailwind CSS
- Vitest for unit and integration tests, Playwright for end-to-end

## Getting started

The quickest path needs only Docker, no Node on the host. It builds the app,
starts PostgreSQL, applies migrations and seeds demo data in one command.

```bash
make env            # create .env.local with generated secrets
docker compose up   # app on http://localhost:3000, database seeded
```

### Running on the host

Prerequisites: Node.js 22 (pinned via `.nvmrc` and `engines`) and Docker for the
local database, or your own PostgreSQL instance. The `make` targets select the
pinned Node version automatically via nvm, so they work even when your shell's
default Node differs.

```bash
make setup   # install deps, create .env.local, start DB, migrate, seed
make run     # start the dev server
```

`make doctor` diagnoses the setup (toolchain, env, Docker, DB, Prisma) and can
auto-fix common issues, including creating `.env.local` and switching to Node 22.
The underlying npm steps (`npm install`, `npm run db:init`, `npm run dev`) still
work if you prefer them.

Open http://localhost:3000 and sign in with the seeded admin account:

```
admin@gardik.local / ChangeMe123!
```

### Switching machines / after `git pull`

With `docker compose up`, migrations and the demo seed run on every start, so a
fresh machine is ready right after `git pull`.

On the host, the Prisma client is regenerated automatically on `npm install`
(`postinstall`). The database is **not** migrated automatically: `npm run dev`
only *warns* if migrations are pending (it never applies them on boot). After
pulling changes that add a migration, apply it explicitly before running the app:

```bash
npm run db:migrate   # prisma migrate deploy, applies pending migrations
```

When you edit `prisma/schema.prisma` yourself, create the migration instead:

```bash
npx prisma migrate dev --name <change>
```

### Database commands

- `npm run db:init` starts a Postgres container (`compose.yml`), applies all
  migrations and seeds demo data (breaches, employees, alerts).
- `npm run db:up` / `npm run db:down` start and stop the container.
- `npm run db:migrate` applies pending migrations to the current database.
- `npm run seed:dev` reseeds the demo data; `npm run seed` seeds only the admin.

No Docker? Point `DATABASE_URL` at your own PostgreSQL, then run
`npx prisma migrate deploy && npm run seed:dev`.

### Environment variables

All variables live in `.env.local` (copied from `.env.example`).
`BETTER_AUTH_SECRET` and `DIRECTORY_ENCRYPTION_KEY` must both be set to real
random values; the rest have working defaults for local development. Set
`CRON_SECRET` too if you want the scheduler to run.

## Docker image

Two images live in this repository. `Dockerfile.dev` is the development one
built by `compose.yml`: it bind-mounts the source and runs `next dev`.
`Dockerfile` is the production one, a multi-stage build that ships the Next.js
standalone server, runs as an unprivileged user and applies pending migrations
on start.

```bash
docker build -t gardik:local .
docker run --rm -p 3000:3000 --env-file .env.local gardik:local
```

The container needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and
`DIRECTORY_ENCRYPTION_KEY`; it refuses to start without a database URL. Set
`RUN_MIGRATIONS=false` when a separate job already applies the schema, for
instance when several replicas start at once.

Tagged releases are published to Docker Hub by
[`docker-publish.yml`](.github/workflows/docker-publish.yml). The job runs in
the protected `dockerhub` environment, so a publication waits for a manual
approval and only runs from `main`, `develop` or a `v*.*.*` tag. The
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets belong to that environment.
Set the `DOCKERHUB_IMAGE` repository variable to publish under a different name
than the default.

## Documentation

- [Authentication and RBAC](docs/auth.md)
- [Encryption at rest](docs/encryption.md)
- [Backup and restore](docs/backup.md)
- [Scheduler](docs/scheduler.md)
- [Production readiness](docs/production-readiness.md)

## Quality and security

Every push and pull request runs an automated pipeline: ESLint (zero warnings
allowed), strict type checking, Prisma schema validation and a production build,
plus CodeQL static analysis, dependency auditing, dependency review and secret
scanning. See [`.github/workflows`](.github/workflows). Security policy and
reporting: [SECURITY.md](.github/SECURITY.md).

## Contributing

Contributions are welcome.

> **Contribution rules are enforced automatically by Git hooks (`.githooks/`) and CI (`.github/workflows/compliance.yml`). Non-compliant PR titles are rejected: invalid conventional commit format, AI attribution trailers, secrets, non-English text, frozen-dependency major bumps, and forbidden code patterns. The hooks activate on `npm install`.**

Please also read [CONTRIBUTING.md](.github/CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md).

## License

Source-available, not open source. You may read, run, modify, fork and
redistribute Gardik, including commercially, but you may not resell the
software itself as a standalone product. See [LICENSE](LICENSE) for the exact
terms.
