# Cron workflows

These two workflows fire the cron-style endpoints under `/api/cron/*` on a
schedule. We use GitHub Actions instead of Vercel Cron because Vercel's
Hobby plan can't run sub-daily schedules — GitHub Actions is free at any
frequency on public repos and gets 2 000 free minutes/month on private
repos (each run uses well under a second).

| Workflow | Schedule (UTC) | Endpoint |
| --- | --- | --- |
| `cron-buyer-product-alerts.yml` | every 12 h (`0 */12 * * *`) | `/api/cron/buyer-product-alerts` |
| `cron-seller-stock-reminders.yml` | daily at 19:00 (= 20:00 WAT) | `/api/cron/seller-stock-reminders` |

## One-time setup

Both workflows need two repo-level secrets. Add them at
**Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
| --- | --- |
| `CRON_BASE_URL` | The site's prod origin, no trailing slash. e.g. `https://streekmart.online` |
| `CRON_SECRET` | A long random string. Generate with `openssl rand -hex 32`. Add the **same value** to your Vercel project env as `CRON_SECRET`. |

The web app reads `CRON_SECRET` (via `src/lib/cron.ts`) and rejects any
unauthenticated call, so the secret is the entire security boundary —
treat it like a database password.

## Manually firing a run

Each workflow has `workflow_dispatch` on, so you can trigger it from the
**Actions** tab → pick the workflow → **Run workflow**. The job's logs
show the HTTP response so you can see exactly what the endpoint returned.

## Changing the schedule

Edit the `cron:` line. GitHub uses standard POSIX cron with five fields
(minute, hour, day-of-month, month, day-of-week) in UTC. Heads-up: GitHub
warns that scheduled workflows can be delayed by up to ~15 min under load.
That's well within tolerance for both of these — a stock reminder that
lands at 20:08 instead of 20:00 still reads as "end of day".

## Local testing

```sh
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/buyer-product-alerts
```

In dev (no `CRON_SECRET` set) the route accepts unauthenticated requests,
so a plain `curl http://localhost:3000/api/cron/...` also works.
