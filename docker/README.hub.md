# Gardik

Self-hosted service that tells a business whether its employees' data has
surfaced in known breaches, with severity-based alerting and a customizable
security dashboard.

Source, issues and full documentation: https://github.com/WhiteMuush/Gardik

## Tags

| Tag | Content |
| --- | --- |
| `latest` | The most recent release. |
| `1.2.3`, `1.2` | A specific release, and the moving minor line. |
| `edge` | Built manually from a branch. Not a release, do not run it in production. |

Images are `linux/amd64`. Each one carries the Next.js standalone server and
runs as an unprivileged user.

## Quick start

The app needs a PostgreSQL 16 database. The container applies pending
migrations on start, so a fresh database is ready without any extra step.

```yaml
services:
  app:
    image: whitemuush/gardik:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      # Replace pw with the password you set on the db service below.
      DATABASE_URL: postgresql://gardik:pw@db:5432/gardik
      BETTER_AUTH_SECRET: replace-with-openssl-rand-base64-32
      BETTER_AUTH_URL: https://gardik.example.com
      DIRECTORY_ENCRYPTION_KEY: replace-with-openssl-rand-base64-32
      # First start only, both together. See First administrator below.
      BOOTSTRAP_ADMIN_EMAIL: admin@yourdomain.com
      BOOTSTRAP_INVITE_TOKEN: replace-with-openssl-rand-hex-32
    ports:
      - "3000:3000"

  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: gardik
      POSTGRES_PASSWORD: pw
      POSTGRES_DB: gardik
    volumes:
      - gardik-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gardik -d gardik"]
      interval: 5s
      timeout: 3s
      retries: 20

volumes:
  gardik-db-data:
```

```bash
docker compose up -d
```

The app answers on port 3000. Generate every secret with
`openssl rand -base64 32`; never reuse the placeholders above.

## First administrator

A fresh database holds no accounts, and public sign-up is disabled, so the first
administrator is created at start-up or not at all. Set both variables before the
first `docker compose up -d`:

    BOOTSTRAP_ADMIN_EMAIL=admin@acme.com
    BOOTSTRAP_INVITE_TOKEN=<the output of: openssl rand -hex 32>

Generate this one with `-hex`, not the `-base64` used for the other secrets.
The token travels in a URL, and base64 output contains `+` and `/`, which a
query string decodes as something else: the link would fail with "no longer
valid" and no clue why. Hex is URL-safe, so it can be pasted as it is.

Both are required together: one without the other is refused, and the container
says which one is missing. A token shorter than 32 characters is refused too.

The domain of the address becomes the company. `admin@acme.com` creates a company
named `acme.com`, which you can rename later in the settings.

On start the container logs two lines, and no secret:

    [bootstrap] Created company acme.com and administrator admin@acme.com.
    [bootstrap] Open https://gardik.example.com/invite with the token you supplied.

Open `<BETTER_AUTH_URL>/invite?token=<BOOTSTRAP_INVITE_TOKEN>`, choose a password,
and enrol a second factor if the company requires one. You are then signed in.
Remove both variables afterwards.

**The link is the only credential.** No password is ever read from the
environment, and there is no default account to change: an image nobody has
bootstrapped has no way in at all. The token is never written to the logs, which
is why you supply it rather than the container generating one.

**It closes for good.** The step is skipped as soon as any account has a
password, so it cannot be used later to add an administrator to a running
instance.

**The link lasts 24 hours.** If it expires, or you lose it, restart the
container. The same token is reissued with a fresh window for as long as nobody
has set a password, so there is nothing to rotate and nothing to clean up. A
restart logs `Reissued the invitation for ...` instead of `Created ...`, because
nothing was created that time.

## Configuration

Required. The container refuses to start without a database URL, and the app
refuses to handle directory credentials without an encryption key.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | Signs sessions. 32 random bytes. |
| `BETTER_AUTH_URL` | Public base URL of the deployment, used for auth callbacks. |
| `DIRECTORY_ENCRYPTION_KEY` | Encrypts directory connection secrets at rest. 32 characters minimum. |

Optional.

| Variable | Purpose |
| --- | --- |
| `HIBP_API_KEY` | Enables Have I Been Pwned breach lookups. Without it, no external lookup runs. |
| `CRON_SECRET` | Secures `POST /api/cron`. Without it the endpoint returns 503 and no scan is scheduled. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email alerts to company admins. Both are needed, otherwise alerts are skipped. |
| `DIRECTORY_ENCRYPTION_KEY_PREVIOUS` | Former encryption key, read during a key rotation. |
| `RUN_MIGRATIONS` | Set to `false` to skip `prisma migrate deploy` on start, when a separate job owns the schema. |
| `BOOTSTRAP_ADMIN_EMAIL` | Creates the first administrator on start. See First administrator. |
| `BOOTSTRAP_INVITE_TOKEN` | Invitation token for that administrator. 32 characters minimum, URL-safe, from `openssl rand -hex 32`. Required alongside the address. |

## Operating notes

**Migrations.** The entrypoint applies them before the server starts. Running
several replicas at once means several concurrent migration attempts: give the
schema to a single job and set `RUN_MIGRATIONS=false` on the replicas.

**Health.** `GET /api/health` returns 200 with `{"status":"ok","db":"up"}` when
the process is up and the database is reachable, 503 otherwise. It is
unauthenticated and exposes no data, so it is safe as a probe.

**Scheduled scans.** Nothing runs on a timer inside the container. Set
`CRON_SECRET`, then have an external scheduler call `POST /api/cron` with the
header `authorization: Bearer <CRON_SECRET>`.

**Reverse proxy.** The image serves plain HTTP on 3000. Terminate TLS in front
of it and make `BETTER_AUTH_URL` match the public HTTPS URL, otherwise the
authentication callbacks break.

## License

See the LICENSE file in the source repository.
