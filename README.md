# Go3net Office

**The cloud-based business operating system by Go3net Technologies Ltd.**

Go3net Office is a modular, multi-tenant SaaS platform that unifies HR, projects, tasks, CRM, finance, inventory, learning, documents, chat, knowledge, help desk, calendar, and an AI assistant into one premium, mobile-first product — built to scale from a 5-person startup to a 100,000-user enterprise.

## Monorepo Layout

```
.
├── apps/
│   ├── api/          # Laravel 12 REST API (PHP 8.4, Sanctum, Horizon, multi-tenant)
│   ├── web/          # Next.js 15 frontend (TypeScript, Tailwind, shadcn/ui, Framer Motion)
│   └── mobile/       # Flutter mobile app (Android / iOS, offline-first)
├── docs/             # PRD, SRS, architecture, ERD, design system, security, ops
├── infrastructure/
│   ├── docker/       # Dockerfiles, nginx config
│   └── github/       # CI/CD reference workflows
├── .github/workflows # GitHub Actions CI/CD
└── docker-compose.yml
```

## Quick Start (Development)

```bash
# Full stack via Docker
docker compose up -d

# API (Laravel)
cd apps/api
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve            # http://localhost:8000

# Web (Next.js)
cd apps/web
npm install
npm run dev                  # http://localhost:3000
```

Default seeded login: `admin@go3net.com` / `password` (change immediately).

## Documentation

| Document | Path |
|---|---|
| Product Requirements (PRD) | [docs/01-prd.md](docs/01-prd.md) |
| Software Requirements (SRS) | [docs/02-srs.md](docs/02-srs.md) |
| System Architecture | [docs/03-architecture.md](docs/03-architecture.md) |
| Database Schema & ERD | [docs/04-database-schema.md](docs/04-database-schema.md) |
| API Reference | [docs/05-api.md](docs/05-api.md) |
| UI/UX Design System | [docs/06-design-system.md](docs/06-design-system.md) |
| Security | [docs/07-security.md](docs/07-security.md) |
| Deployment Guide | [docs/08-deployment.md](docs/08-deployment.md) |
| Backup, DR & Scaling | [docs/09-operations.md](docs/09-operations.md) |
| User Flows | [docs/10-user-flows.md](docs/10-user-flows.md) |
| Roadmap & Module Status | [docs/11-roadmap.md](docs/11-roadmap.md) |
| Production Deployment Runbook (VPS) | [docs/12-deployment-runbook.md](docs/12-deployment-runbook.md) |
| Railway Deployment Guide | [docs/13-railway-deployment.md](docs/13-railway-deployment.md) |

## Brand

Primary `#2DA9DD` · Secondary `#1E293B` · Accent `#00C2FF` · Success `#22C55E` · Warning `#F59E0B` · Danger `#EF4444` · Background `#F8FAFC` · Typeface **Inter**

## License

Proprietary — © Go3net Technologies Ltd. All rights reserved.
