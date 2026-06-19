# Scheduling (auto scan + sync)

DataShield does periodic work, exposure scans and directory syncs, without a
dedicated worker process. The model is "internal cron + table": schedule state
lives in the database, and a single tick endpoint advances it. An external
scheduler calls the endpoint on a fixed interval.

## Configuration

- **Directory sync** (per connection): `DirectoryConnection.autoSyncIntervalMinutes`
  (null = disabled). Set it via `PATCH /api/directory/:id`
  `{ "autoSyncIntervalMinutes": 60 }`. SCIM connections are push-based and
  cannot be put on a pull schedule.
- **Exposure scan** (per company): `Company.scanIntervalMinutes` (null =
  disabled). Set it via `PATCH /api/company` `{ "scanIntervalMinutes": 1440 }`.

Both intervals must be `null` or an integer >= 5 minutes.

## The tick endpoint

`POST /api/cron`, authenticated with `CRON_SECRET`:

```
curl -X POST -H "authorization: Bearer $CRON_SECRET" https://your-host/api/cron
```

Without `CRON_SECRET` set, the endpoint returns 503. Each tick:

1. Enqueues a `SyncJob` for every connection whose `autoSyncIntervalMinutes`
   has elapsed since `lastSyncAt`.
2. Starts an exposure scan for every company whose `scanIntervalMinutes` has
   elapsed since `lastScanAt` (stamped up front so a slow scan is not
   re-triggered).
3. Drains the sync queue (`processSyncJobs`), which runs syncs with retry and
   backoff (see #54).

## Driving the tick

Run the call on whatever cron you have, e.g. every 5 minutes:

- **System cron**: `*/5 * * * * curl -fsS -X POST -H "authorization: Bearer $CRON_SECRET" https://your-host/api/cron`
- **Vercel Cron / similar**: schedule a POST to `/api/cron` and inject the
  header.

The tick is idempotent: nothing runs before its interval elapses, and sync
concurrency is guarded by the job claim, so overlapping ticks are safe.

## Notes

- Directory sync is durable (queued, retried). Auto-scan currently runs
  detached (fire-and-forget) and is not yet retried; a failed scheduled scan is
  retried on the next due tick.
