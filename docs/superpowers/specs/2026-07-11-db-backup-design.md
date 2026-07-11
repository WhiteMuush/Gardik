# Database backup and restore - design

Date: 2026-07-11. Closes the "DB backups" item in
[production-readiness.md](../../production-readiness.md) (tracks #59).

## Goal

Give operators of this self-hosted service a documented, tooled way to back
up the PostgreSQL database and restore it, including a tested restore
procedure. V1 scope: `pg_dump`-based tooling for the compose stack, generic
guidance for any self-hosted PostgreSQL, and a pointer to managed-database
native backups when available.

## Decisions

- Approach: shell scripts in `scripts/`, wired as npm scripts, wrapped by
  make targets. Matches the existing `db:init` pattern
  (Makefile -> npm -> `scripts/*.sh`).
- Dump format: `pg_dump -Fc` (custom format). Compressed, supports selective
  restore via `pg_restore`.
- Dumps land in `backups/` at the repo root, gitignored, named
  `datashield-YYYYMMDD-HHMMSS.dump`.
- Restore is destructive: explicit file argument required, interactive
  confirmation (`yes`) before overwriting.
- Canonical documentation lives in `docs/backup.md` (reviewed, versioned with
  the scripts, ASCII-checked by CI). The GitHub wiki gets a short
  operator-facing "Backup and Restore" page that links to it.
- No scheduled backup sidecar, no scripted verify target. Scheduling belongs
  to the operator (crontab example in the doc); restore verification is a
  documented manual procedure.

## Files

| File | Change |
| --- | --- |
| `scripts/db-backup.sh` | New. Dump the compose database. |
| `scripts/db-restore.sh` | New. Restore a dump into the compose database. |
| `package.json` | Add `db:backup` and `db:restore` scripts. |
| `Makefile` | Add `backup` and `restore` targets (`$(N) npm run ...` style). |
| `.gitignore` | Add `backups/`. |
| `docs/backup.md` | New. Canonical backup/restore documentation. |
| `docs/production-readiness.md` | Mark "DB backups" Done, link the doc. |
| Wiki `Backup-and-Restore.md` | New short page linking to `docs/backup.md`; add to `_Sidebar.md`. Pushed separately after merge (the wiki has no PR flow). |

## scripts/db-backup.sh

- `set -euo pipefail`.
- Fail with a clear message if the `db` compose service is not running
  (suggest `npm run db:up`).
- `mkdir -p backups`, then
  `docker compose exec -T db pg_dump -Fc -U ${POSTGRES_USER:-user} ${POSTGRES_DB:-datashield}`
  redirected to `backups/datashield-<timestamp>.dump` (same env defaults as
  `compose.yml`).
- Print the resulting path and size.

## scripts/db-restore.sh

- `set -euo pipefail`.
- Require one argument (dump path); error if missing or not a file.
- Warn that the restore overwrites the current database and require the
  literal answer `yes` to continue; abort otherwise.
- Fail with a clear message if the `db` compose service is not running.
- `docker compose exec -T db pg_restore --clean --if-exists -U ... -d ...`
  reading the dump from stdin.
- On success, suggest running `npx prisma migrate status` to confirm schema
  consistency.

## docs/backup.md outline

1. Strategy for self-hosted PostgreSQL: `pg_dump -Fc`, example retention
   (7 daily + 4 weekly), crontab example.
2. Managed PostgreSQL (RDS, Cloud SQL, ...): prefer native backups and PITR.
3. Compose stack commands: `make backup`, `make restore FILE=...`.
4. Restore test procedure, step by step, to run periodically. A backup that
   was never restored is not a backup.
5. Encryption key warning: `DIRECTORY_ENCRYPTION_KEY` must be backed up
   separately from the database; a dump without the key means directory
   configs are unrecoverable. Link to [encryption.md](../../encryption.md).

## Error handling

Boundary validation only: missing argument, missing file, db container not
running, failed confirmation. Everything else propagates via `set -e`.

## Verification

No TypeScript touched, so lint/tsc gates are unaffected; CI compliance checks
the new docs (ASCII). Manual end-to-end check before review: seed the dev
database, `make backup`, mutate or reset data, `make restore FILE=...`,
confirm seeded rows are back and `prisma migrate status` is clean.
