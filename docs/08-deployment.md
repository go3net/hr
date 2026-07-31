# Go3net Office — Deployment Guide

## 1. Environments
| Env | Purpose | Branch | URL pattern |
|---|---|---|---|
| Local | Development | any | localhost |
| Staging | Pre-prod QA | `develop` | `*.staging.go3net.app` |
| Production | Live | `main` (tagged releases) | `*.go3net.app` |

## 2. Stack
Docker Compose (v1 production; Kubernetes-ready images): `api` (php-fpm), `worker` (Horizon), `scheduler`, `reverb` (WebSockets), `web` (Next.js standalone), `nginx`, `postgres`, `redis`. Cloudflare fronts NGINX (proxy + WAF + CDN). Object storage: any S3-compatible (AWS S3 / Cloudflare R2 / MinIO locally).

## 3. Local Development
```bash
git clone <repo> && cd hr
docker compose up -d                      # full stack
# or run natively:
cd apps/api && cp .env.example .env && composer install \
  && php artisan key:generate && php artisan migrate --seed && php artisan serve
cd apps/web && npm install && npm run dev
```
Services: API http://localhost:8000 · Web http://localhost:3000 · Mail (dev) via log driver.

## 4. Production Deploy (GitHub Actions)
Pipeline (`.github/workflows/`):
1. **ci.yml** — on PR/push: PHP setup → composer install → Pint (style) → PHPUnit against Postgres+Redis services; Node setup → npm ci → lint → typecheck → `next build`.
2. **deploy.yml** (on tag `v*`) — build & push Docker images (`api`, `web`) with commit SHA tags → SSH to host → `docker compose pull` → run migrations in one-off container (`php artisan migrate --force`) → rolling restart → health-check `/up` → notify.

Rollback: redeploy previous image tag; migrations are expand/contract (additive first, destructive in a later release) so old code runs against new schema.

## 5. Server Provisioning (single-node start)
- Ubuntu 24.04 LTS, 4 vCPU / 8 GB minimum; Docker + Compose plugin; UFW allow 80/443 only (Cloudflare IPs ideally); fail2ban.
- DNS: `A *.go3net.app` → origin; Cloudflare SSL Full (strict) with origin certificate.
- `.env` files delivered from secret manager at deploy time — never committed.

## 6. Post-Deploy Checklist
- [ ] `/up` returns 200; Horizon dashboard green; Reverb connected
- [ ] `php artisan queue:monitor` thresholds configured
- [ ] Sentry release created with sourcemaps (web) and commits linked
- [ ] Backup cron verified (see docs/09-operations.md)
- [ ] Smoke E2E: login → dashboard → clock-in → leave request

## 7. Scaling Path
Single node → split DB to managed PostgreSQL (with PITR) → multiple API/worker nodes behind LB → read replicas → Kubernetes when node count > ~5. Redis to managed/cluster at >50k concurrent users. Details in docs/09-operations.md.
