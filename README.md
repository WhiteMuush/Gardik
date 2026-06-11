# DataShield

> ### 🚧 Work in progress, projet en construction
>
> DataShield is under active development and is **not production ready**. The
> database schema, APIs and UI can change without notice, features may be
> incomplete or unstable, and breaking changes land regularly. Do not point it
> at real production data yet. Ce projet est en cours de construction.

Self-hosted service that tells a business whether its employees' data has
surfaced in known breaches, with severity-based alerting and a customizable
security dashboard.

## Status

Early development. Things move fast and not everything listed below is finished.

## Features (in progress)

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

Prerequisites: Node.js 20 or later and a PostgreSQL database.

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment (see below), then apply the schema
npx prisma migrate dev

# 3. Run the development server
npm run dev
```

### Environment variables

Create a `.env.local` file at the project root:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/datashield
# 32 characters minimum. Used to encrypt directory connection secrets.
# The app refuses to handle directory configs without it.
DIRECTORY_ENCRYPTION_KEY=change-me-to-a-long-random-32-char-secret
# Required by Auth.js for session encryption.
AUTH_SECRET=change-me-to-a-random-secret
# Optional, enables Have I Been Pwned breach lookups.
HIBP_API_KEY=
```

## Quality and security

Every push and pull request runs an automated pipeline: ESLint (zero warnings
allowed), strict type checking, Prisma schema validation and a production build,
plus CodeQL static analysis, dependency auditing, dependency review and secret
scanning. See [`.github/workflows`](.github/workflows). Security policy and
reporting: [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome.

> **Contribution rules are enforced automatically by Git hooks (`.githooks/`) and CI (`.github/workflows/compliance.yml`). Non-compliant PR titles are rejected: invalid conventional commit format, AI attribution trailers, secrets, non-English text, frozen-dependency major bumps, and forbidden code patterns. The hooks activate on `npm install`.**

Please also read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

See [LICENSE](LICENSE).
