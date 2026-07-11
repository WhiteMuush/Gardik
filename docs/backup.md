# Database backup and restore

How to back up and restore the DataShield PostgreSQL database. The strategy
applies to any self-hosted deployment; the tooling targets the local compose
stack.

## Back up the encryption key first

`DIRECTORY_ENCRYPTION_KEY` (and `DIRECTORY_ENCRYPTION_KEY_PREVIOUS` during a
rotation) must be backed up separately from the database, in your secrets
manager. Directory connection configs are encrypted at rest with this key
(see [encryption.md](encryption.md)); a database dump without the key means
those configs are unrecoverable.

## Managed PostgreSQL

If the database runs on a managed service (RDS, Cloud SQL, ...), prefer the
provider's native automated backups and point-in-time recovery over pg_dump.
The encryption key warning above still applies.

## Self-hosted strategy

- Tool: `pg_dump` custom format (`-Fc`); compressed, restores selectively
  with `pg_restore`.
- Frequency: daily at minimum.
- Retention example: 7 daily dumps plus 4 weekly dumps.
- Store dumps off the database host (object storage or another machine).
  Dumps contain employee PII: store them encrypted and access-controlled.

Crontab example (daily at 02:00, prune local dumps after 7 days):

    0 2 * * * cd /path/to/DataShield && npm run db:backup && find backups -name '*.dump' -mtime +7 -delete

## Compose stack commands

- `make backup` (or `npm run db:backup`): writes
  `backups/datashield-<timestamp>.dump`.
- `make restore FILE=backups/<file>.dump` (or
  `npm run db:restore -- backups/<file>.dump`): destructive, asks for
  confirmation, then runs `pg_restore --clean --if-exists`.

`backups/` is gitignored; never commit dumps.

## Restore test procedure

A backup that was never restored is not a backup. Run this quarterly, and
after any change to the backup setup. Use a disposable environment (the
local compose stack), never production.

1. `npm run db:init` to get a seeded database.
2. `make backup`; note the dump file name.
3. Note the employee count:
   `docker compose exec -T db psql -U user -d datashield -tAc 'SELECT count(*) FROM "Employee";'`
4. Wipe the table:
   `docker compose exec -T db psql -U user -d datashield -c 'TRUNCATE "Employee" CASCADE;'`
5. `make restore FILE=backups/<file>.dump` and confirm with `yes`.
6. The count from step 3 is back, and `npx prisma migrate status` reports the
   schema is up to date.
