# Go3net Office — Production Deployment Runbook

A step-by-step guide from a blank server to a running, paid, real-time
Go3net Office. Follow it top to bottom for a first deployment; the
[Upgrades](#9-upgrades) section covers every deployment after that.

The stack is the repository's `docker-compose.yml`: Postgres 16, Redis 7,
the Laravel API (php-fpm), a queue worker, a scheduler, Laravel Reverb
(WebSockets), the Next.js web app, and NGINX in front of everything.

---

## 1. What you need before starting

| Item | Notes |
|---|---|
| A Linux server | Ubuntu 22.04+ / Debian 12+, 2 vCPU + 4 GB RAM minimum (4 vCPU + 8 GB comfortable). Hetzner, DigitalOcean, AWS Lightsail all work |
| A domain | e.g. `go3net.app`. Tenant subdomains (`acme.go3net.app`) need a wildcard DNS record |
| Cloudflare account (recommended) | Free tier gives TLS, WebSocket proxying and caching with zero certificate management on the server |
| Paystack account | Live secret + public keys from [dashboard.paystack.com](https://dashboard.paystack.com) → Settings → API Keys |
| Anthropic API key | From [console.anthropic.com](https://console.anthropic.com) — powers the AI assistant |
| SMTP credentials | Any provider (Resend, Postmark, SES, Mailgun). Without them mail falls back to the log driver |
| OAuth apps (optional) | Google / Microsoft / GitHub sign-in — create apps in each provider's console |

## 2. DNS

Point these records at your server's IP (proxied through Cloudflare if using it):

```
A     go3net.app        → <server IP>
A     api.go3net.app    → <server IP>
A     *.go3net.app      → <server IP>     # tenant subdomains
```

In Cloudflare: SSL/TLS mode **Full**, and confirm **WebSockets** are enabled
(Network tab — on by default). Wildcard records are proxied on all plans for
first-level subdomains.

## 3. Server preparation

```bash
# As root on the fresh server
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# Deploy user
adduser --disabled-password deploy
usermod -aG docker deploy
su - deploy
git clone https://github.com/go3net/hr.git go3net-office
cd go3net-office
```

## 4. Environment

All configuration flows through a single `.env` file next to
`docker-compose.yml` (Compose reads it automatically). Create it:

```bash
# .env  (chmod 600)
APP_ENV=production
APP_KEY=                # generate below
APP_URL=https://api.go3net.app
FRONTEND_URL=https://go3net.app
HTTP_PORT=80

DB_PASSWORD=            # long random string

# Public host used by browsers for the WebSocket connection
PUBLIC_HOST=go3net.app
PUBLIC_WS_PORT=443
PUBLIC_SCHEME=https

# Real-time (any long random strings)
REVERB_APP_ID=go3net
REVERB_APP_KEY=
REVERB_APP_SECRET=

# Mail
MAIL_MAILER=smtp
MAIL_HOST=smtp.resend.com
MAIL_PORT=587
MAIL_USERNAME=resend
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=office@go3net.app
MAIL_FROM_NAME="Go3net Office"

# Money + AI (leave blank to keep the feature dormant)
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
ANTHROPIC_API_KEY=sk-ant-...

# OAuth sign-in (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Generate the secrets:

```bash
# APP_KEY
docker run --rm php:8.4-cli php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
# DB_PASSWORD / REVERB_APP_KEY / REVERB_APP_SECRET
openssl rand -hex 32
```

> **Build-time note:** `REVERB_APP_KEY`, `PUBLIC_HOST`, `PUBLIC_WS_PORT` and
> `PUBLIC_SCHEME` are baked into the web bundle during `docker compose build`.
> If you change any of them later, rebuild the `web` image.

## 5. First boot

```bash
docker compose build
docker compose up -d

# Database schema + module/permission/role catalog
docker compose exec api php artisan migrate --force
docker compose exec api php artisan db:seed --class=ModuleSeeder --force
docker compose exec api php artisan db:seed --class=RolePermissionSeeder --force

# Cache config/routes for production speed
docker compose exec api php artisan config:cache
docker compose exec api php artisan route:cache
```

Check everything came up:

```bash
docker compose ps                       # all services Up / healthy
curl -s https://api.go3net.app/up       # Laravel health: 200
curl -s https://go3net.app/login -o /dev/null -w '%{http_code}\n'   # 200
```

Create the first workspace by visiting `https://go3net.app/register` — the
first user of each tenant becomes its Super Admin and starts a 14-day trial.

## 6. External service wiring

### Paystack webhook
Dashboard → Settings → API Keys & Webhooks → Webhook URL:

```
https://api.go3net.app/api/v1/billing/webhook/paystack
```

Requests are verified with an HMAC-SHA512 signature of the raw body using
your secret key — no extra shared secret to configure. Test with a card in
test mode first (switch the keys, run a checkout from Settings → Billing).

### OAuth redirect URIs
When creating each provider app, use:

```
https://api.go3net.app/api/v1/auth/oauth/google/callback
https://api.go3net.app/api/v1/auth/oauth/microsoft/callback
https://api.go3net.app/api/v1/auth/oauth/github/callback
```

OAuth is **sign-in only** — accounts must already exist in a workspace.

### AI assistant
Nothing beyond `ANTHROPIC_API_KEY`. The `/assistant` page activates on the
next page load; without the key every AI endpoint returns a clean
`AI_NOT_CONFIGURED` and the UI shows a setup notice.

## 7. Verifying the deployment

Run through this ten-minute checklist after first boot:

1. **Register** a workspace, log in, confirm the dashboard renders.
2. **2FA**: Settings → enable, scan into an authenticator, confirm.
3. **Real-time**: open Chat in two browsers (two users), send a message —
   it must appear without a refresh. If not, see
   [Troubleshooting](#10-troubleshooting) → WebSockets.
4. **Mail**: submit a leave request; the approver should receive an email.
5. **Queue**: `docker compose logs worker --tail 20` shows processed jobs.
6. **Billing** (test keys): Settings → Billing → choose a plan → pay with a
   Paystack test card → subscription flips to Active.
7. **Payroll PDF**: run a draft payroll, publish, download a payslip.

## 8. Backups

The two things that matter: the Postgres volume and the API storage volume
(uploads: documents, logos, payslips, CVs).

```bash
# Nightly dump (add to deploy user's crontab)
docker compose exec -T postgres pg_dump -U go3net go3net | gzip \
  > ~/backups/go3net-$(date +%F).sql.gz

# Uploads
docker run --rm -v go3net-office_apistorage:/data -v ~/backups:/backup \
  alpine tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

Ship both offsite (rclone to S3/B2 is the simplest). Test a restore once:
`gunzip -c dump.sql.gz | docker compose exec -T postgres psql -U go3net go3net`.

## 9. Upgrades

```bash
cd ~/go3net-office
git pull
docker compose build
docker compose up -d                          # rolling recreate
docker compose exec api php artisan migrate --force
docker compose exec api php artisan config:cache && \
docker compose exec api php artisan route:cache
docker compose exec worker php artisan queue:restart   # pick up new code
```

Migrations are additive; never run `migrate:fresh` in production. The
GitHub Actions `deploy.yml` workflow builds and pushes images to GHCR on
tags if you later want pull-based deploys instead of building on-server.

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `502` from the web app | `api` or `web` container down — `docker compose ps`, then `docker compose logs api web` |
| Login works but every page says API unreachable | BFF can't reach nginx's internal `:81` listener — check `docker compose logs nginx`, confirm the `web` service env has `API_URL=http://nginx:81` |
| Chat needs a refresh to show messages | WebSocket not connecting. Browser devtools → Network → WS: the `wss://go3net.app/app/<key>` request should be `101`. Check the `reverb` container is up and Cloudflare WebSockets are enabled. Remember `REVERB_APP_KEY` is baked at build time — rebuild `web` after changing it |
| Emails not arriving | `MAIL_MAILER` still `log`? Check `docker compose logs worker` for mail jobs and your SMTP provider's activity view |
| Paystack webhook shows failures | URL must be exactly `/api/v1/billing/webhook/paystack`; a 401 means the secret key in `.env` doesn't match the dashboard's |
| `413` uploading documents | nginx `client_max_body_size` is 25m — raise it in `infrastructure/docker/nginx.conf` and `docker compose restart nginx` |
| Payslip download empty | queue worker down when the run was published — restart worker, re-publish the run |
| Locked out (subscription expired) | Sign in still works; only billing/auth/profile routes stay open. Pay via Settings → Billing, or extend manually: `docker compose exec api php artisan tinker` → `Tenant::find(ID)->update(['subscription_ends_at' => now()->addMonth()])` |

## 11. Scaling notes

- **More workers**: `docker compose up -d --scale worker=3` — jobs are
  Redis-backed and safe to consume concurrently.
- **Postgres**: move to a managed instance (RDS/DO) by changing `DB_HOST`;
  everything else is stateless except the `apistorage` volume.
- **Uploads to S3**: set the `AWS_*` env vars and `FILESYSTEM_DISK=s3`
  (league/flysystem-aws-s3-v3 is already installed) to detach file state
  from the server entirely.
- **Observability**: point a free uptime monitor at `/up`, and add Sentry
  DSNs to both apps when ready (packages install cleanly on this stack).
