# DataShield

<div align="center">

<!-- CI -->
[![CI](https://github.com/WhiteMuush/DataShield/actions/workflows/ci.yml/badge.svg)](https://github.com/WhiteMuush/DataShield/actions/workflows/ci.yml)
[![Security](https://github.com/WhiteMuush/DataShield/actions/workflows/security.yml/badge.svg)](https://github.com/WhiteMuush/DataShield/actions/workflows/security.yml)
[![Compliance](https://github.com/WhiteMuush/DataShield/actions/workflows/compliance.yml/badge.svg)](https://github.com/WhiteMuush/DataShield/actions/workflows/compliance.yml)
[![CodeQL](https://github.com/WhiteMuush/DataShield/actions/workflows/codeql.yml/badge.svg)](https://github.com/WhiteMuush/DataShield/actions/workflows/codeql.yml)

<!-- Stack -->
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-prisma-4169e1?logo=postgresql&logoColor=white)

</div>

Self-hosted service that tells a business whether its employees' data has
surfaced in known breaches, with severity-based alerting and a customizable
security dashboard.

## Status

v1.0.0. The production readiness checklist is tracked in
[docs/production-readiness.md](docs/production-readiness.md).

## Features

- Breach exposure monitoring per employee (Have I Been Pwned and manual sources)
- Customizable widget dashboard (drag and drop, saved presets)
- Employee directory sync: Microsoft Entra ID (Azure AD), Google Workspace,
  LDAP / Active Directory, AWS IAM Identity Center, Okta, and inbound SCIM 2.0
- Alerting by severity and status

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript in strict mode
- Prisma 7 with PostgreSQL
- Auth.js (next-auth v5)
- Tailwind CSS

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
admin@datashield.local / ChangeMe123!
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

All variables live in `.env.local` (copied from `.env.example`). `AUTH_SECRET`
must be set; the rest have working defaults for local development.

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

See [LICENSE](LICENSE).
