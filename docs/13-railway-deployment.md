# Go3net Office — Deploying on Railway

For teams already on Railway (this guide assumes an existing account and
familiarity with the dashboard). The product becomes **five Railway
services from this one repo** plus Railway's managed **Postgres** and
**Redis**. Uploads move to S3-compatible storage (Cloudflare R2's free
tier is ideal) because Railway services don't share disks.

```
┌─ Railway project: go3net-office ─────────────────────────┐
│  api        Laravel HTTP API          (public domain)    │
│  worker     queue:work                (no domain)        │
│  scheduler  schedule:work             (no domain)        │
│  reverb     WebSockets                (public domain)    │
│  web        Next.js UI                (public domain ⭐) │
│  Postgres   plugin                                       │
│  Redis      plugin                                       │
└──────────────────────────────────────────────────────────┘
```

## 1. Project + databases

1. New Project → **Deploy from GitHub repo** → `go3net/hr` (deploy the
   default branch — merge PR #1 first).
2. In the same project: **+ New → Database → PostgreSQL**, then again for
   **Redis**.
3. The first service Railway auto-created will become `api` — rename it.

## 2. The five services

Create each with **+ New → GitHub Repo → go3net/hr**, then set, per
service (Settings → unless noted):

| Service | Root directory | Build | Start command |
|---|---|---|---|
| `api` | `apps/api` | Nixpacks (auto-detects Laravel) | *(default)* |
| `worker` | `apps/api` | Nixpacks | `php artisan queue:work --queue=default,notifications,reports --tries=3` |
| `scheduler` | `apps/api` | Nixpacks | `php artisan schedule:work` |
| `reverb` | `apps/api` | Nixpacks | `php artisan reverb:start --host=0.0.0.0 --port=$PORT` |
| `web` | `apps/web` | Nixpacks (Node) | `npx next start -p $PORT` |

Generate public domains (Settings → Networking) for `api`, `reverb` and
`web` only. On the `reverb` service also set the variable `PORT=8080` so
its private-network port is predictable.

## 3. Variables

Use a **Shared Variable group** for the PHP services (`api`, `worker`,
`scheduler`, `reverb` all get the same set):

```bash
APP_ENV=production
APP_KEY=            # php artisan key:generate --show  (run locally)
APP_URL=https://<api-domain>
FRONTEND_URL=https://<web-domain>

# Databases — reference the plugins
DB_CONNECTION=pgsql
DB_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

# Uploads on S3-compatible storage (Cloudflare R2 free tier works)
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=auto
AWS_BUCKET=go3net-office
AWS_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_USE_PATH_STYLE_ENDPOINT=true

# Real-time — api/worker reach reverb over Railway's private network
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=go3net
REVERB_APP_KEY=      # openssl rand -hex 32
REVERB_APP_SECRET=   # openssl rand -hex 32
REVERB_HOST=reverb.railway.internal
REVERB_PORT=8080
REVERB_SCHEME=http

# Mail
MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=office@yourdomain.com
MAIL_FROM_NAME="Go3net Office"

# Integrations (blank = feature stays dormant)
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
ANTHROPIC_API_KEY=
FIREBASE_CREDENTIALS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

On the `web` service only:

```bash
API_URL=https://<api-domain>
NEXT_PUBLIC_REVERB_KEY=<same REVERB_APP_KEY>
NEXT_PUBLIC_REVERB_HOST=<reverb-domain>      # no scheme, e.g. reverb-production-xxxx.up.railway.app
NEXT_PUBLIC_REVERB_PORT=443
NEXT_PUBLIC_REVERB_SCHEME=https
```

> `NEXT_PUBLIC_*` values are baked in at build time — changing them later
> requires a redeploy of `web`, which Railway does automatically when you
> save variables.

## 3b. Auto-deploy on merge

A service needs two separate things to redeploy on a push, and it is easy
to have only the first:

1. **A source** — the repo recorded on the service. Set at creation.
2. **A branch trigger** — the GitHub webhook that fires the build.

Services created through the Railway **API** get a source but *no*
trigger, so they never auto-deploy even though the dashboard shows the
repo connected and offers no "Connect repo" prompt. Verify with:

```graphql
query { deploymentTriggers(projectId: "…", environmentId: "…", serviceId: "…")
        { edges { node { repository branch } } } }
```

An empty result means no trigger. Fix it in the dashboard: **service →
Settings → Source → disconnect**, then reconnect the repo and pick the
branch. Reconnecting is what registers the webhook. Root directory and
start command survive the reconnect. Deployment triggers cannot be
created with a project token (`Bad Access`) — this step needs the
dashboard or an account token.

## 4. First boot

Migrations run automatically: the Nixpacks PHP provider executes
`php artisan migrate --force` on each deploy. **Seeders do not run.**
That matters for the permission catalogue — a sprint that adds a
permission must ship it as a migration (see
`database/migrations/*_sync_role_permissions.php`, which re-runs the
idempotent `RolePermissionSeeder`), otherwise the permission exists in
code but not in the database and every role check against it fails.

The module registry still needs seeding once, from your machine with the
Railway CLI (`railway link` to the project first):

```bash
railway run --service api php artisan db:seed --class=ModuleSeeder --force
```

Then visit `https://<web-domain>/register`, create the first workspace —
its first user is Super Admin with a 14-day trial.

## 5. Domains, webhooks, checks

- **Custom domains**: attach `go3net.app` (and the wildcard
  `*.go3net.app` for tenant subdomains) to the `web` service, and
  `api.go3net.app` to `api`. Update `APP_URL`, `FRONTEND_URL`, `API_URL`
  and the `NEXT_PUBLIC_REVERB_HOST` afterwards.
- **Paystack webhook**: `https://<api-domain>/api/v1/billing/webhook/paystack`
- **OAuth redirect URIs**: `https://<api-domain>/api/v1/auth/oauth/<provider>/callback`
- **Verification**: run the 7-step checklist from
  [the runbook §7](12-deployment-runbook.md#7-verifying-the-deployment) —
  registration, 2FA, two-browser chat (WebSocket), mail, worker logs,
  test-card billing, payslip PDF.

## 6. Notes & gotchas

| Topic | Note |
|---|---|
| Deploys | Every push to the tracked branch redeploys all five services; scope with Settings → "Watch paths" (`apps/api/**` for PHP services, `apps/web/**` for web) to avoid needless rebuilds |
| Proxy/HTTPS | Already handled — the API trusts `X-Forwarded-*` headers, so generated URLs are https |
| Logs | Each service's Deployments tab; the worker's log is where queued mail/PDF/push failures appear |
| Costs | Five small services + two plugins typically lands ~$15–35/mo depending on traffic; the worker and reverb idle cheaply |
| Scaling | Bump `worker` replicas for heavy payroll months; Postgres/Redis scale from the plugin settings |
| Backups | Enable Railway's Postgres backups; R2 holds uploads independently |
