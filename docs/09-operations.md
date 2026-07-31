# Go3net Office — Backup, Disaster Recovery & Scaling

## 1. Backup Strategy
| Asset | Method | Frequency | Retention |
|---|---|---|---|
| PostgreSQL | WAL archiving + base backups (pgBackRest) → offsite S3 | Continuous (WAL) + nightly base | 30 days PITR, 12 monthly archives |
| Object storage | Cross-region replication + versioning | Continuous | 90-day version history |
| Redis | Not backed up (cache/queues are re-derivable); RDB snapshot for queue durability | 15 min | 24 h |
| Config/secrets | Secret manager versioning | On change | Full history |

- **RPO ≤ 15 min** (WAL shipping) · **RTO ≤ 1 h** (restore runbook, rehearsed quarterly).
- Restore drill: quarterly, restore latest backup to staging, run integrity suite (row counts, checksum sampling, app smoke test); drill results logged.
- Per-tenant export: admins can export their tenant's data (JSON/CSV bundle) — also serves offboarding.

## 2. Disaster Recovery
Scenarios & responses:
- **Node loss:** images + compose files are declarative — reprovision via infra scripts, restore DB from PITR, repoint DNS (Cloudflare TTL 5 min).
- **Region loss:** offsite backups in second region; cold-standby runbook (target < 4 h) at v1, warm standby with streaming replica at scale.
- **Data corruption / bad deploy:** PITR to pre-incident timestamp into side-by-side database; reconcile deltas; expand/contract migrations make rollback safe.
- **Ransomware/compromise:** immutable (object-lock) backup copies; restore to clean infra; rotate all secrets.

## 3. Scaling Strategy
**Vertical first, then horizontal.** Stateless API makes scale-out trivial.

| Trigger | Action |
|---|---|
| API P95 > 250 ms sustained | Add API pods; verify OPcache/JIT; profile top endpoints |
| Queue latency > 30 s | Scale Horizon workers per queue (payroll/reports isolated pools) |
| DB CPU > 60% sustained | Add read replicas (reports/dashboard reads routed), then partition hot tables (attendance, audit, messages) |
| >100k users / mega-tenant | Move tenant to dedicated schema/DB via TenantContext connection map |
| WebSocket fan-out limits | Reverb horizontal scale with Redis pub/sub backplane |
| Global latency | Cloudflare CDN for static + edge-cached public pages; regional API PoPs (v2) |

**Caching layers:** HTTP (Cloudflare, static + public career pages) → application (Redis: bootstrap payloads, dashboard aggregates 60 s TTL, permission sets, module flags) → query (materialized views for analytics, refreshed by scheduler).

**Load testing:** k6 scenarios (login storm, clock-in spike at 8–9 AM — the known thundering herd, payroll day) run against staging before each release; budgets asserted in CI.

## 4. Monitoring & Alerting
- **Uptime:** external probe on `/up` + synthetic login every 60 s.
- **Golden signals dashboards:** latency, traffic, errors, saturation per service.
- **Alerts (paged):** error rate > 2%, P95 > 600 ms 5 min, queue depth > 10k, DB connections > 80%, disk > 80%, failed backup, certificate expiry < 14 days.
- **Business telemetry:** signups, activation funnel, module adoption, AI credit burn — to the analytics dashboard.
