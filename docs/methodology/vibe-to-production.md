# VIBE TO PRODUCTION™
## The AI-Powered Software Development Methodology

**Extracted from:** `go3net/hr` — the Go3net Office platform
**Method:** reverse-engineering of a real, deployed, AI-built codebase
**Evidence base:** 73 commits · 22 merged pull requests · 2026-07-31 → 2026-08-12 · 14,546 lines of API PHP · 16,410 lines of web TypeScript · 5,199 lines of tests · 1,562 lines of product documentation
**Status:** analysis and documentation only — no application code was modified to produce this document

---

## How to read this document

Three kinds of statement appear throughout, and they are always labelled:

| Label | Meaning |
|---|---|
| **FACT** | Directly observable in the repository — a file, a commit, a config value, a test. Verifiable by anyone with the repo. |
| **RECOMMENDATION** | Methodology guidance. Informed by the evidence but not itself evidence. This is the teachable part. |
| **UNKNOWN** | Cannot be determined from the codebase. Not guessed at. |

Section 22 collects all three into separate consolidated lists, as requested.

### Where each requested part is answered

| Requested part | Answered in |
|---|---|
| Part 1 — Understand the application | §3 |
| Part 2 — Reconstruct the development journey | §4 |
| Part 3 — How Claude Code was used | §5 |
| Part 4 — ChatGPT + Claude workflow | §6 |
| Part 5 — The ideal development process | §7 |
| Part 6 — Idea to PRD | §8 |
| Part 7 — PRD to architecture | §9 |
| Part 8 — Building without losing control | §10 |
| Part 9 — Debugging methodology | §11 |
| Part 10 — Testing | §12 |
| Part 11 — Making the app professional | §13 |
| Part 12 — Deployment | §15 |
| Part 13 — Domain + live website | §16 |
| Part 14 — Production management | §17 |
| Part 15 — The master AI development prompt | §18 |
| Part 16 — Prompt library | §19 |
| Part 17 — What a beginner should know | §20 |
| Part 18 — Lessons from this project | §21 |
| Facts / Recommendations / Unknowns separation | §22 |
| Recommended ebook structure | §23 |

---

# 1. Executive Summary

This repository is unusually good raw material for a methodology, because the methodology is *legible in the git history*. Three properties make it so:

1. **Documentation came first.** The root commit of the repository is not code. It is `9406a60 docs: add product, architecture, and operations documentation suite` — 13 documents, 1,174 lines: PRD, SRS, architecture, ERD, API contract, design system, security posture, deployment, operations, user flows, roadmap. Every line of code that follows was written against a written specification. **FACT.**

2. **Features shipped as vertical slices.** After the initial scaffold, 20 consecutive commits each deliver one module end-to-end — migration + model + service + controller + routes + permissions + frontend page + feature tests — at a consistent 1,000–1,800 insertions per commit, each commit message ending with a running test count ("Suite: 103 passing (549 assertions)"). **FACT.**

3. **The commit messages are engineering documents.** They state the symptom, the root cause, the reasoning behind the fix, what was verified and how. Example: *"The personal dashboard filtered tasks on a `tasks.assignee_id` column that does not exist — assignment is a `task_assignees` many-to-many. Postgres rejected it and the endpoint 500'd in production. The test missed it because it never created a task, so the counter returned zero either way."* This is the single most valuable artifact in the repo for teaching purposes. **FACT.**

The methodology this document extracts, in one sentence:

> **Write the specification before the code, build one vertical slice at a time, make every slice prove itself with a test that would fail without it, and treat deployment as a feature you build rather than an event that happens at the end.**

The counter-lesson is equally important and equally visible. The project's failure modes were not "AI wrote bad code." They were:

- **UI/API drift** — the API accepted a field for weeks that no screen could ever set (payroll could not run at all because nothing in the product could set a salary; tasks could not be assigned to anyone because the form had no assignee field). **FACT.**
- **Documentation drift** — the security document claims PHPStan level 8, gitleaks, Trivy, Dependabot, Sentry and Row-Level Security. None of them exist in the repository. **FACT.**
- **Environment drift** — tests run against in-memory SQLite; production runs PostgreSQL. A query that SQLite tolerated in a vacuous test 500'd on Postgres in production. **FACT.**
- **Platform surprises** — five of the first ten deployment commits were fixing things nobody could have known without deploying: PHP version resolution, a missing PHP extension, seeders that never run, deploy triggers that silently do not exist. **FACT.**

A methodology that only teaches how to generate features teaches the easy half. This one teaches the drift.

---

# 2. Core Philosophy

Six principles, each traceable to evidence in this repository.

### 2.1 The specification is the product; the code is an implementation detail
The PRD in `docs/01-prd.md` defines 14 modules with an explicit **MVP column** and calls it "the contract." The roadmap in `docs/11-roadmap.md` tracks every capability with ✅ / 🏗️ / 📋 / ⬜ status and a one-line note on what is genuinely done versus what is next. Two months of work stayed coherent because the target was written down. **FACT → RECOMMENDATION:** never let an AI start building from a chat message. Build from a document you can diff.

### 2.2 A feature is not done until a human has used it in a browser
Commit after commit ends with a verification sentence: *"Verified live end-to-end through the web BFF"*, *"Verified on an iPhone 13 viewport against a local stack"*, *"verified live: two-user conversation through the web BFF with correct unread counts on both sides"*, *"a real termination through the form left the employee exited with 'Left the company (resigned)' in their history."* **FACT.** The features that broke in production were, without exception, the ones where this step was skipped or done shallowly.

### 2.3 Vertical slices, never horizontal layers
No commit in this repository says "add all the models" or "add all the controllers." Every feature commit crosses every layer at once for exactly one capability. **FACT.** This is why the app was demonstrable at every point in its history, and why 22 pull requests could be reviewed individually.

### 2.4 Every test must be capable of failing
The strongest single line in the history: *"added a token-auth regression test **proven to fail without the fix**"* (`3132efd`). The weakest moment in the history is its inverse: a dashboard test that "passed vacuously" because it never created the row the query counted. **FACT → RECOMMENDATION:** the question to ask of any AI-written test is not "does it pass?" but "did you watch it fail first?"

### 2.5 Unconfigured features must be dormant, not broken
`AiGateway::isConfigured()` returns false without an API key and the endpoints return a clean `AI_NOT_CONFIGURED` with a setup notice in the UI. Mail falls back to the log driver. Push notifications add themselves to the notification channel list *only* when FCM is configured **and** the user has a registered device. Blank integration keys in `docker-compose.yml` are commented: *"blank disables the feature gracefully."* **FACT.** This is what lets one codebase ship before every third-party account exists.

### 2.6 Deployment is a feature with its own bug backlog
The repository contains two deployment guides totalling 19,465 bytes, a five-service Railway topology, a bash deploy driver that polls each service to green, a CI workflow that refuses to deploy a red build, and a diagnostic step whose entire job is to explain *why* a secret looks empty. **FACT.** None of that was in the original plan. All of it was written in response to real failures.

---

# 3. The Project as Evidence (Part 1)

Answers to the sixteen questions, from the codebase.

### 3.1 What application is being built?
**Go3net Office** — a multi-tenant SaaS "business operating system" by Go3net Technologies Ltd. `README.md`: *"a modular, multi-tenant SaaS platform that unifies HR, projects, tasks, CRM, finance, inventory, learning, documents, chat, knowledge, help desk, calendar, and an AI assistant into one premium, mobile-first product."* **FACT.**

The repository is named `hr` and HR is by far the deepest module (14 controllers, 5 services, 8 sub-pages), which suggests HR was the origin and the platform grew around it. **RECOMMENDATION-grade inference, not fact.**

### 3.2 What problem does it solve?
From `docs/01-prd.md`: replacing "a patchwork of tools (BambooHR + Monday + Slack + QuickBooks + Google Admin)" for organizations "across Africa and beyond — SMEs, schools, NGOs, churches, startups, and enterprises," with Africa-first compliance as the wedge: NIN, BVN, PAYE, pension. **FACT.** The payroll engine implements Nigerian PAYE with *versioned* tax tables (Nigeria Tax Act 2025 bands effective 2026, plus the legacy PITA/CRA table, selected by run year) — the clearest evidence that the localization claim is real and not marketing. **FACT** (`config/payroll.php`, `PayeCalculationTest.php`, 5 unit tests pinned to hand-computed values).

### 3.3 Who are the users?
Six personas in the PRD, each with a job to be done: CEO/Founder (mobile executive dashboard), HR Manager (recruitment→exit lifecycle with Nigerian compliance), Department Manager (approvals, tasks, KPIs), Employee/Corps Member/Intern (GPS/QR clock-in, leave, payslips — mobile-first), Finance Officer (invoices, payroll runs, bank exports), IT/Super Admin (tenants, roles, audit, integrations). **FACT.**

A seventh actor exists in code but not in the PRD: the **platform owner** — Go3net staff running the business across all tenants. Added late (`f61a8cc`, 2026-08-12) with access granted by account (`is_platform_owner` flag or `PLATFORM_OWNER_EMAILS`), explicitly *not* by permission, "so no workspace administrator can grant it to themselves." **FACT.**

### 3.4 Major features
34 named permissions across 16 module keys. Implemented and reachable in the UI: dashboard (personal + company variants), employees with encrypted personnel file, departments, positions, work schedules, attendance (GPS geofence / QR / web with late detection), leave (types, balances, multi-approver workflow), payroll (draft→approve→publish, PAYE + pension, payslip PDFs, bank CSV export, per-item adjustments), onboarding checklists, company assets (assign/return/history), exits with clearance gating, recruitment ATS (drag-and-drop pipeline, hire-to-employee conversion), performance OKRs, employee self-service profile with completion meter, manager team view, projects (kanban + milestones), tasks, CRM (leads→clients→deals pipeline), finance (transactions with approval, invoices, payments), inventory (stock movements with negative-stock guards), LMS (courses/lessons/enrollment/progress), documents (folders, sharing, S3-ready), chat (real-time over WebSockets), knowledge base, help desk (ticket numbering, internal notes, SLA-less), calendar (RSVP, company events, .ics export), AI assistant (grounded chat + document drafting), notifications (in-app + email + FCM push), billing (Paystack checkout, webhooks, trial enforcement), white-label branding, custom roles, platform console. **FACT** — cross-checked against `routes/api.php`, the page tree, and `docs/11-roadmap.md`.

### 3.5 Major modules (code structure)
`apps/api/app/Modules/`: Ai, Billing, Calendar, Chat, Crm, Dashboard, Documents, Finance, Helpdesk, Hr, Inventory, Knowledge, Lms, Platform, Projects, Settings, Tasks — 17 module directories. Each contains `Http/` (controllers) and, where there is real business logic, `Services/`. Shared kernel in `app/Core/`: `Tenancy/`, `Modules/`, `Http/`, `Notifications/`, `Push/`. **FACT.**

Note the deviation from the plan: `docs/03-architecture.md` specifies per-module `Requests/`, `Resources/`, `Repositories/`, `DTOs/`, `Policies/`, `Events/`, `Listeners/`, `Database/Migrations` and a `routes.php`. In reality there are **0 FormRequest classes** (82 inline `$request->validate()` calls), **0 Repository classes**, **0 Policy classes** (authorization goes through `ApiController::requirePermission()` → a `Gate::define('permission')` check), **0 per-module route files** (one 400-line `routes/api.php`), **0 per-module migration directories** (one flat `database/migrations/`), and all 60 models sit flat in `app/Models/`. **FACT.** See §21 for why this matters and why it partly does not.

### 3.6–3.9 Technology stack
| Layer | Choice | Evidence |
|---|---|---|
| Backend | PHP 8.4, Laravel 12 | `composer.json`: `"php": "^8.4"`, `"laravel/framework": "^12.0"` |
| API style | REST/JSON, `/api/v1/*`, envelope `{data, meta}` / `{error:{code,message,fields}}` | `routes/api.php`, `Core/Http/ApiController.php` |
| Frontend | Next.js 16.2.12, React 19.2.4, TypeScript 5 | `apps/web/package.json` |
| Styling | Tailwind CSS v4 + CSS custom-property design tokens | `globals.css`, `@tailwindcss/postcss` |
| UI primitives | Radix UI (avatar, dialog, dropdown, label, select, slot, tabs, tooltip) in a shadcn-style `components/ui/` | `package.json`, `components/ui/*.tsx` |
| Icons | Lucide | `lucide-react` |
| Server state | TanStack Query v5 | `hooks/use-api.ts` |
| Forms | React Hook Form + Zod | `package.json` |
| Charts | Recharts | `components/charts/dashboard-charts.tsx` |
| Theming | next-themes (light/dark/system) | `providers.tsx` |
| Real-time | Laravel Reverb (server) + laravel-echo & pusher-js (client) | `composer.json`, `lib/echo.ts` |
| PDF | barryvdh/laravel-dompdf | payslip generation job |
| 2FA | pragmarx/google2fa | `TwoFactorController` |
| OAuth | Laravel Socialite + socialiteproviders/microsoft | `OAuthController` |
| Storage | league/flysystem-aws-s3-v3 (S3/R2), local disk in dev | `composer.json`, `FILESYSTEM_DISK` |
| Mobile | Flutter — **scaffold only**: 3 files (`README.md`, `lib/main.dart`, `pubspec.yaml`) | `apps/mobile/` |

**Database:** PostgreSQL 16 in production (`docker-compose.yml`, Railway Postgres plugin, `DB_CONNECTION=pgsql`). **SQLite in tests** (`phpunit.xml`: `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`) and SQLite is the default in `.env.example`. Redis 7 for cache, queues and sessions in production; database driver in the example env. **FACT — and this divergence caused a production 500 (§21).**

### 3.10 Authentication system
Laravel Sanctum tokens, wrapped by a Next.js **BFF (backend-for-frontend)** layer so the browser never holds an API token:

- `POST /api/auth/login` (Next route handler) exchanges credentials with Laravel, stores the Sanctum token in an **HttpOnly cookie** named `g3_session`.
- `/api/backend/[...path]` proxies every subsequent call server-side, attaching `Authorization: Bearer <token>` from the cookie (`lib/server/backend.ts`). No CORS surface exists.
- Route guard in `apps/web/src/proxy.ts` — Next 16's successor to `middleware.ts` — redirects signed-out users to `/login`, signed-in users away from auth pages, with an explicit `ALWAYS_REACHABLE` exemption for `/accept-invite`.
- TOTP 2FA: enroll → confirm-with-live-code → enabled; 8 single-use recovery codes hashed at rest; login returns a 5-minute cached challenge token instead of a session when 2FA is armed.
- OAuth (Google, Microsoft, GitHub) is **sign-in only** — the account must already exist in a workspace. The callback mints a 2-minute one-time exchange code and bounces to the frontend, so tokens never travel in URLs.
- Invitations: sha256-hashed single-use token, 7-day expiry, one live invitation per user, re-send rotates the token.
- WebSocket channel auth is proxied too (`/api/broadcasting/auth`), so the browser authorizes private channels without ever holding the API token.

**Authorization:** 34 permissions named `module.resource.action`, grouped into 11 system roles plus tenant-defined custom roles; `super_admin` short-circuits to allow-all. Enforced server-side via `requirePermission()`; mirrored client-side in `nav-config.ts` and `<RequirePermission>` purely to avoid showing doors that will not open — the code comment says so explicitly. **FACT.**

**Tenant isolation:** `BelongsToTenant` trait adds a global `TenantScope` (`where tenant_id = current`) and auto-fills `tenant_id` on create. `ResolveTenant` middleware resolves the tenant from — in priority order — the authenticated user (authoritative), the `X-Tenant` header, then the subdomain. Critically, middleware **priority** is declared in `bootstrap/app.php` so `ResolveTenant` runs *before* `SubstituteBindings`; without that ordering, route-model binding resolved unscoped and a cross-tenant id could leak. That was a real bug, fixed in `3132efd` with a regression test proven to fail without the fix. **FACT.**

### 3.11–3.12 Third-party services and APIs
| Service | Purpose | Degradation when unconfigured |
|---|---|---|
| **Anthropic Claude API** (Messages API, tool use) | AI assistant: grounded chat over tenant data, document drafting | `AI_NOT_CONFIGURED` (503) + UI setup notice |
| **Paystack** | Subscription checkout; webhooks verified with HMAC-SHA512, constant-time compare | Billing page inert |
| **Firebase Cloud Messaging** (HTTP v1, no SDK — service-account JSON → RS256 JWT → access token cached ~55 min) | Push notifications | Channel omitted from `via()` |
| **Google / Microsoft / GitHub OAuth** | Sign-in | Buttons dormant |
| **SMTP** (Resend/Postmark/SES/Mailgun) | Notification email | Falls back to log driver |
| **S3-compatible storage** (AWS S3 / Cloudflare R2 / MinIO) | Documents, payslips, logos, CVs | Local disk |
| **Railway** | Hosting, Postgres, Redis; GraphQL API driven from CI | — |
| **Cloudflare** | TLS, WAF, CDN, WebSocket proxying (compose path) | — |

The AI integration is worth studying as a pattern: `AiToolbox` exposes **six allowlisted, tenant-scoped, permission-filtered tools** (employee search, leave, attendance, projects, deal pipeline, finance summary), and "responses never include salaries, bank details or identity numbers." `AiGateway` runs a bounded tool-use loop (`max_tool_rounds: 6`), handles `stop_reason: refusal`, and meters input/output tokens per tenant into `ai_usage_logs`. Retrieved tenant content is treated as data, never instructions. **FACT.**

### 3.13 Hosting / deployment
Two complete paths exist:

1. **Railway (the live one).** Five services from one monorepo — `api`, `worker`, `scheduler`, `reverb`, `web` — plus managed Postgres and Redis plugins, uploads on S3/R2 because Railway services do not share disks. Real project, environment and service IDs are committed in `infrastructure/railway/services.json`. Deploys run from GitHub Actions (`railway-deploy.yml` → `infrastructure/railway/deploy.sh`) triggered by `workflow_run` on a **successful** CI run on `main`, one at a time (`concurrency: railway-deploy`), `api` first because it carries the migrations. **FACT.**
2. **Docker Compose on a VPS.** `docker-compose.yml` defines postgres, redis, api (php-fpm), worker, scheduler, reverb, web, nginx, with a shared `apistorage` volume and a documented blank-server-to-live runbook (`docs/12-deployment-runbook.md`). A tag-triggered `deploy.yml` builds images to GHCR and deploys over SSH. **FACT.** Whether this path is currently in use is **UNKNOWN**; the Railway path is the one CI actually exercises.

### 3.14 Domain configuration
Designed for wildcard tenant subdomains: `A go3net.app`, `A api.go3net.app`, `A *.go3net.app`, Cloudflare SSL Full, WebSockets enabled. Tenants get `acme.go3net.app`; Enterprise gets custom domains (planned — `docs/11-roadmap.md` says "Custom domains + email templates next"). **FACT as design.** Whether `go3net.app` is registered, live, or currently pointed anywhere is **UNKNOWN** — DNS state is not in a repository.

### 3.15 Environment variables required
Consolidated from `.env.example`, `docker-compose.yml`, and both runbooks. **FACT.**

**Core:** `APP_ENV`, `APP_KEY`, `APP_DEBUG`, `APP_URL`, `FRONTEND_URL`
**Database:** `DB_CONNECTION=pgsql`, `DB_HOST`/`DB_URL`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
**Infrastructure:** `REDIS_URL`/`REDIS_HOST`, `CACHE_STORE=redis`, `QUEUE_CONNECTION=redis`, `SESSION_DRIVER=redis`
**Real-time:** `BROADCAST_CONNECTION=reverb`, `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME`
**Web (build-time!):** `API_URL`, `NEXT_PUBLIC_REVERB_KEY`, `NEXT_PUBLIC_REVERB_HOST`, `NEXT_PUBLIC_REVERB_PORT`, `NEXT_PUBLIC_REVERB_SCHEME`
**Mail:** `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`
**Storage:** `FILESYSTEM_DISK=s3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_ENDPOINT`, `AWS_USE_PATH_STYLE_ENDPOINT`
**Money:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
**AI:** `ANTHROPIC_API_KEY`, `AI_MODEL_CAPABLE` (default `claude-opus-5`), `AI_MODEL_FAST` (default `claude-haiku-4-5`), `AI_MAX_TOKENS`
**Push:** `FIREBASE_CREDENTIALS` (service-account JSON, inline or path)
**OAuth:** `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `MICROSOFT_TENANT_ID`, `GITHUB_CLIENT_ID/SECRET`
**Platform:** `PLATFORM_OWNER_EMAILS`
**CI/CD:** `RAILWAY_TOKEN` (secret), `RAILWAY_ENVIRONMENT_ID` (variable), plus `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY` for the SSH path

Two of these are trip-wires the repo learned the hard way: **`NEXT_PUBLIC_*` and `REVERB_APP_KEY` are baked into the web bundle at build time** — changing them requires a rebuild, and runtime env is silently ignored (`cba55e5`, and warned about in both runbooks). **FACT.**

### 3.16 External integrations summary
Inbound: Paystack webhook (`POST /api/v1/billing/webhook/paystack`), OAuth callbacks (`/api/v1/auth/oauth/{provider}/callback`). Outbound: Anthropic, Paystack, FCM/Google OAuth token endpoint, SMTP, S3. Designed but not built: outbound tenant webhooks with `X-Go3net-Signature` HMAC-SHA256 (`docs/05-api.md`), SMS/WhatsApp adapters (Termii/Twilio), Google/Outlook two-way calendar sync (only one-way `.ics` export exists). **FACT.**
---

# 4. Reconstructing the Development Journey (Part 2)

The sequence below is **read off the git history**, not assumed. Dates and commit hashes are given so any claim can be checked.

## The observed sequence

| # | Stage | Evidence | Date |
|---|---|---|---|
| 1 | **Documentation suite first** — PRD, SRS, architecture, ERD, API contract, design system, security, deployment, ops, user flows, roadmap | `9406a60` (13 files, 1,174 insertions, **the root commit**) | 07-31 |
| 2 | **Big-bang scaffold** — Laravel API skeleton (tenancy core, auth, HR core, 9 tests) *and* Next.js design system + app shell + dashboard + placeholder pages for every module | `777c539` (184 files, **25,616 insertions**) | 07-31 |
| 3 | **Infrastructure early** — Dockerfiles, compose, CI, tag-deploy workflow, Flutter scaffold | `185ee3f` | 07-31 |
| 4 | **Wire the frontend to the real API** — BFF session layer, route guard, replace demo data on 4 pages | `765d832` | 07-31 |
| 5 | **Hardest business logic next: payroll** — PAYE engine with versioned tax tables, 5 unit tests pinned to hand-computed values, run lifecycle | `6a91463` | 07-31 |
| 6 | **Payroll polish + a security fix found while building it** — payslip PDFs, adjustments, and the middleware-priority tenant-binding fix | `3132efd` | 07-31 |
| 7–20 | **One module per commit, vertical slices** — projects/tasks → notifications → 2FA/OAuth → documents → chat → CRM → finance → AI → billing → helpdesk/KB → calendar → recruitment/performance → real-time chat client → inventory/LMS → HR lifecycle → branding/roles → live dashboard charts | `669a429` … `f80a022` | 07-31 → 08-01 |
| 21 | **Production hardening of the compose stack** — found by "auditing the stack against the shipped features" | `cba55e5` | 08-01 |
| 22 | **Push notifications** | `6d19a98` | 08-01 |
| 23 | **Deployment attempt → platform reality bites** — proxy trust, then three one-line emergency fixes: CI `--parallel` without ParaTest, PHP `^8.2` vs a lockfile needing 8.4.1, missing `ext-pcntl` for Reverb | `e26da8b`, `b807140`, `a64cddd`, `3cdadad` | 08-01 |
| 24 | **First real users → onboarding gaps** — employee invitations, shareable setup link (because SMTP was not configured yet), the `/register` page that *never existed* though login linked to it, slug field swallowing spaces | `faaded8` … `cd3d898` | 08-01 → 08-03 |
| 25 | **Admin CRUD gaps** — departments page, positions page + employee editing | `1097f33`, `28a954d` | 08-04 |
| 26 | **Role-shaped features** — employee self-service profile, manager team view | `5aeef98` | 08-04 |
| 27 | **Deployment mechanics, properly** — permissions shipped as migrations, gotchas documented, deploy from CI, checkout the right commit, diagnose empty secrets | `929ff1b` … `5be7de9` | 08-04 |
| 28 | **Production bug fixes from real use** — employee saw the admin dashboard (security), dashboard 500 on a non-existent column, no mobile navigation at all, invite link unusable on a phone | `ad5342a`, `b3c486b`, `cfdd97e`, `bf9125b` | 08-04 |
| 29 | **"It works but nobody can use it" gaps** — task form could not set description or assignees, no screen could set a salary so payroll could never run, leave types were read-only, permissions page unreachable from nav | `c4d764e`, `f9d5bff` | 08-04 |
| 30 | **Deeper usability + admin gaps** — working-hours dialog (late detection was inert without it), dialogs that could not scroll, terminate-vs-delete | `7e51eb5` | 08-10 |
| 31 | **Business layer above the product** — platform owner console, plus a workflow to set a Railway variable from CI | `f61a8cc`, `4a2abf3` | 08-12 |

**The shape of that timeline is the finding.** Roughly: 1 day of specification and scaffolding, 1 day of module construction, then **nine days of deployment reality, usability gaps, and production bugs.** The build was the fast part. **FACT.**

## Stage-by-stage analysis

For each stage: what was done, why, tools, AI's role, human decisions required, failure modes, and handling. Stages 1–8 map to what happened; the "what could go wrong" column is drawn from what *did* go wrong later in this repo.

---

### Stage 1 — Specification (docs before code)

**What was done.** Eleven documents in one commit: vision and personas with names; success metrics with numbers (P95 < 250 ms, LCP < 1.5 s, 99.9% uptime, NPS ≥ 50); competitive positioning with a named weakness per competitor; 14 modules with an MVP-versus-full split; ~90 numbered functional requirements (`FR-AUTH-1` … `FR-RPT-1`) each tagged M/S/C; 10 non-functional requirements; multi-tenancy model; role list; monetization tiers; non-goals; release plan; a risk table with mitigations.

**Why.** The MVP column is called "the contract." With 14 modules in scope, an unwritten scope would have collapsed within days.

**Tools.** Markdown in the repo. Mermaid for diagrams. Nothing else.

**What AI did.** Drafted all of it from a product brief, in the house voice, with internal consistency across eleven documents (the ERD matches the SRS which matches the API reference).

**What the human decided.** Everything that cannot be derived: the market (Africa-first), the wedge (NIN/BVN/PAYE compliance), the pricing tiers and numbers, the non-goals, the module priority order, the personas' actual jobs, and the quality bar ("premium by default… never admin-template aesthetics").

**What could go wrong.** Specification that reads beautifully and describes a system nobody will build. **This happened here:** `docs/07-security.md` promises PHPStan level 8, gitleaks, Trivy, Dependabot, annual pentest and Postgres RLS; none exist. `docs/02-srs.md` NFR-9 promises ≥80% coverage on services/policies and E2E smoke in CI; there are no E2E tests and no coverage gate.

**How to handle it.** Split the documents in two: **Contract** (what the code must do — reviewed and enforced) and **Intent** (what we aspire to — dated, labelled as aspiration). Then add a rule: any claim in the Contract must be traceable to a test, a config file, or a CI step. Re-run that trace at every release. See Rule 21 in §10.

---

### Stage 2 — Scaffolding

**What was done.** One commit of 25,616 insertions across 184 files created the Laravel API skeleton *and* the entire Next.js design system, app shell, dashboard and placeholder pages for all 16 modules.

**Why.** Speed, and a real reason: placeholder pages for every module made the navigation and information architecture concrete on day one, which made every later module a fill-in rather than a design decision.

**Tools.** `laravel new`, `create-next-app`, then Claude Code writing the shared kernel (tenancy, module registry, API base controller) and the token-based design system.

**What AI did.** Wrote the tenancy primitives (`BelongsToTenant`, `TenantScope`, `TenantContext`, `ResolveTenant`), the design tokens with light/dark values, the app shell, and 16 coming-soon pages.

**What the human decided.** Monorepo layout; modular monolith over microservices; shared-database multi-tenancy with `tenant_id` (documented as the best cost/ops profile at this scale); Next.js BFF over direct browser→API calls; the brand palette; Inter.

**What could go wrong.** A 25,616-line commit cannot be reviewed. Anything wrong inside it persists as "how the codebase is." **This happened here:** the architecture document's layering (FormRequests, Repositories, DTOs, Policies, per-module routes and migrations) was never implemented, and by the time module 3 was built, the flat structure *was* the convention. Nobody chose that; it was inherited from a commit too large to inspect.

**How to handle it.** Scaffold in three reviewable commits — (1) framework skeletons and CI, (2) the shared kernel with its tests, (3) the design system with a component gallery page — and **verify the kernel against the architecture doc before writing feature one.** A 30-minute review at that moment is worth weeks later.

---

### Stage 3 — Infrastructure before features

**What was done.** Dockerfiles (multi-stage: base/worker/scheduler with OPcache JIT configured), compose with health-checked Postgres and Redis, CI running API tests plus web lint and build, and a tag-triggered image build/deploy — all before the second feature existed.

**Why.** A green CI badge from commit 3 means every subsequent commit is proven to at least install, lint, typecheck, build and pass tests.

**What AI did.** Wrote all of it, including the OPcache tuning and the multi-stage target split.

**What the human decided.** Docker as the packaging boundary; GitHub Actions; Postgres + Redis.

**What could go wrong.** CI that tests something different from what production runs. **This happened here:** CI installs `pdo_sqlite` and `phpunit.xml` pins `DB_CONNECTION=sqlite`, `:memory:`, while production is Postgres 16. A query referencing a non-existent column reached production because no test exercised it *and* the test database was a different engine.

**How to handle it.** Run CI against the same engine as production from day one — a `services: postgres:16` block in the workflow costs three lines and 20 seconds per run. The original `docs/08-deployment.md` even specified this ("PHPUnit against Postgres+Redis services"); the implementation quietly did not.

---

### Stage 4 — Connect the frontend to real data early

**What was done.** BFF auth (`/api/auth/login` → HttpOnly cookie; `/api/backend/*` proxy), the route guard, and four pages converted from demo data to live API calls — dashboard, employees, leave, attendance. Verified end-to-end: "login → bootstrap → clock-in → leave submit/approve → balance deduction."

**Why.** The moment the frontend eats real API responses, every later module is built against reality. Demo data hides contract mismatches.

**What could go wrong.** Leaving demo data in place too long. **Partially happened:** dashboard charts kept a `demo-data.ts` import until `f80a022`, and `lib/demo-data.ts` still exists in the tree today. Any demo fallback is a place where the UI can look healthy while the API is broken.

**How to handle it.** Treat demo data as scaffolding with a deletion deadline. One rule: a page may ship with demo data exactly once, and the commit that ships it must name the commit that will remove it.

---

### Stage 5–6 — Hardest business logic first

**What was done.** Payroll before projects, before chat, before CRM: versioned Nigerian PAYE tables selected by run year, pensionable-pay rules, 8%/10% pension split, annualized progressive tax, a draft→approve→publish lifecycle with a duplicate-period guard, then payslip PDFs via a queued job, per-item adjustments (taxable-not-pensionable bonuses, post-tax deductions) with full recomputation, and a bank export.

**Why.** Payroll is the requirement most likely to invalidate the data model. Building it early meant the model was shaped by the hardest case, not retrofitted to it.

**What AI did.** Implemented the engine and wrote 5 unit tests **pinned to hand-computed values** — the correct pattern for anything with money in it. AI can compute a tax band; only a human can say "this is the number the tax authority expects."

**What the human decided.** Which tax regime; that historical runs must compute on their historical table (the versioning decision); that a run must be previewable before it is published.

**What could go wrong.** Confidently wrong financial arithmetic. Also: an engine nobody can feed. **This happened here** in the most instructive way in the whole repository — `PayrollService` only includes employees with a `base_salary`, and **no screen in the product could set a salary**, so every payroll run failed with "no active employees with a salary were found" until `f9d5bff` on 2026-08-04, four days after the engine shipped.

**How to handle it.** For any engine, write the **input path** in the same slice as the engine, and make the acceptance test start from the UI, not the service. See Rule 6 (§10).

---

### Stage 7–20 — Module construction as vertical slices

**What was done.** Fourteen commits, each one module or module pair, each crossing all layers: migration → model → service (where logic existed) → controller with inline validation → routes with module + permission middleware → seeded permissions → frontend page and dialogs → 2–7 feature tests → a running suite count.

**Why.** Every commit left the product demonstrable, and every pull request was individually reviewable (22 of them).

**What AI did.** Essentially all of the writing, including the tests, plus live end-to-end verification through the running stack.

**What the human decided.** Module order; what "done" means per module (the roadmap's "next" notes show deliberate deferral: "Sprints/Gantt/dependencies next", "Quizzes + certificates next"); which permissions each role gets; when a workflow needs a hard gate (exit completion requires *all* clearance tasks done **and** zero assets still assigned).

**What could go wrong.** Three things, all of which happened:
1. **API/UI drift** — capability in the API with no way to reach it (tasks: description and assignees accepted by the API since day one, unreachable from any form until `c4d764e`).
2. **Configuration surface omitted** — leave types seeded once and read-only; work schedules with no editor, which silently made late detection inert for every real workspace.
3. **Navigation as a feature** — the roles and permissions page existed and worked, but nothing linked to it, so it was reported as missing.

**How to handle it.** Add three items to the definition of done for every slice: *(a)* every field the API accepts is settable from a screen or explicitly documented as API-only; *(b)* every seeded default has an editor; *(c)* every new page is reachable from navigation, permission-filtered. See Rules 5, 6, 7 (§10).

---

### Stage 21–23 — Deployment

**What was done.** Compose stack audited against the shipped features (which turned up a missing Reverb service, an nginx `SCRIPT_FILENAME` resolving inside the wrong container, `NEXT_PUBLIC_*` passed at runtime where only build-time works, and uploads that would not survive a restart); then a Railway five-service topology; then a run of one-line emergency fixes; then a CI-driven deploy script.

**Why.** Because the first deploy attempt failed, repeatedly, for reasons no amount of local testing would have surfaced.

**The four platform surprises, verbatim from the history:**
- `b807140` — CI ran `php artisan test --parallel`; ParaTest was not installed.
- `a64cddd` — "The lockfile resolves symfony 8.x packages that need PHP >= 8.4.1; composer.json's `^8.2` made Railway's Nixpacks pick PHP 8.2 and fail composer install."
- `3cdadad` — "Railway's PHP image only installs extensions declared in composer.json; `reverb:start` crashed with 'Undefined constant SIGINT' without pcntl."
- `929ff1b` / `0a6c687` — "Nixpacks runs migrations on every deploy but never seeders, so new permissions have to ship as migrations to reach production." A whole feature (`hr.team.view`) was invisible in production because its permission row did not exist.

Plus the deploy-pipeline surprise: `65d4efe` — "Only `api` auto-deployed on merge; `worker`, `scheduler`, `reverb` and `web` had a repo source but no branch trigger, so they silently drifted — **they were three days behind main and the queue worker did not have the notification classes the running api was dispatching to it.**"

**What could go wrong.** Everything, and it did. The generalizable lesson: **deployment failures are almost never in your code.** They are in version resolution, missing native extensions, what the platform runs automatically versus what it does not, build-time versus runtime configuration, and service-to-service wiring.

**How to handle it.** Deploy an empty app on day one (see §7 Phase 3). Then keep a **platform gotchas document** — this repo's `docs/13-railway-deployment.md` §6 is exactly that, and it exists because two of those bugs each "cost real debugging time and neither was written down."

---

### Stage 24–30 — Production reality

**What was done.** Onboarding gaps (the `/register` page linked from login had never been built — a 404 on production), invitations with a copyable link because SMTP was not wired, admin CRUD that had been assumed, role-appropriate dashboards, a mobile experience that did not previously exist below `lg`, and a run of "it works but nobody can use it" fixes.

**Why.** Real people used it. Every commit in this band is a direct response to something a human hit.

**The four most instructive production bugs** (full analysis in §21): the employee who saw the admin dashboard; the dashboard 500 on `tasks.assignee_id`; no mobile navigation at all; iOS Safari zooming the invitation form because inputs were 14px.

**How to handle it.** Assume this phase exists and budget for it. In this project it was **nine of the twelve days.** A methodology that ends at "deployed" describes a quarter of the work.

---

### Stage 31 — The business above the product

**What was done.** A platform owner console spanning every workspace: signups, plans, revenue, trials about to lapse, suspend/reactivate/move-plan/extend-trial. Access granted by account (`is_platform_owner` or `PLATFORM_OWNER_EMAILS`), never by permission, "so no workspace administrator can grant it to themselves." Tenant isolation still applies to the owner — a test asserts an owner reading another workspace's employee list gets nothing.

**Why.** "Super Admin is the top of one workspace; nothing until now sat above all of them."

**Lesson.** Multi-tenant products need a **second, differently-authorized control plane**, and its boundary should be asserted by a test, not by intention. Note also the deployment constraint driving the design: "The config route exists because the hosted stack runs migrations on deploy and nothing else — without it, granting the first owner would need a database shell nobody has." Operational reality shaped the security design, correctly.

---

# 5. How Claude Code Should Be Used, Stage by Stage (Part 3)

**RECOMMENDATION**, informed by what worked and failed here.

| Stage | Objective | What Claude Code should do | What the human should do | Expected output |
|---|---|---|---|---|
| **Project analysis** | Build a shared, accurate mental model before changing anything | Read the tree, package manifests, routes, migrations, CI; produce a written map: stack, module boundaries, conventions, where the seams are; name what the docs claim that the code does not do | Read the map and correct it. Decide which drift matters | A 1–2 page project map committed as `docs/00-map.md`, plus a drift list |
| **Planning** | Turn a want into a scoped, ordered slice list | Propose 3–8 vertical slices in dependency order, each with acceptance criteria, the files it will touch, and the tests it will add. Flag anything ambiguous instead of choosing silently | Cut scope. Reorder. Answer the ambiguities. Approve the *first slice only* | An ordered slice plan; explicit go-ahead on slice 1 |
| **Architecture** | Fix the decisions that are expensive to reverse | Lay out 2–3 options per decision with trade-offs and a recommendation; write an ADR per decision once chosen | Choose. Architecture is a business decision (cost, hiring, ops) — never delegate it | Short ADRs (`docs/adr/NNN-*.md`) |
| **File creation** | Establish conventions before volume | Create the first example of each kind (one controller, one service, one page, one test) and stop for review | Review the *shape*: naming, layering, error envelope, validation location. This review sets the codebase's style permanently | Reviewed reference implementations |
| **Feature development** | One capability, all layers, working | Migration → model → service → controller → routes → permissions → UI → tests, then run the app and use the feature. Report what was verified and how | Use the feature yourself. Look for the gap between "responds 200" and "a person can do their job" | One reviewable commit; a working feature; a verification note |
| **Database work** | Change schema without losing data | Write additive, reversible migrations; never edit a shipped migration; state the expand/contract plan for destructive changes | Approve every schema change. Confirm the production backup exists before it runs | Migration + rollback note |
| **API development** | A contract clients can trust | Follow the existing envelope, status codes, validation and pagination conventions; update the API doc in the same commit | Check the contract against the consumer. Decide breaking-change policy | Endpoints + updated `docs/05-api.md` |
| **UI development** | Screens people can actually operate | Build from design tokens and existing primitives, with loading, empty and error states; make every API-supported field reachable; add the nav entry | Click through on desktop **and** a real phone viewport. Judge whether it feels finished | Pages, dialogs, nav entry, states |
| **Authentication** | Correct identity and access | Implement the flow, then write adversarial tests: wrong tenant, expired token, missing permission, replayed code, session held by the wrong person | Decide the policy: who may do what, session lifetime, 2FA enforcement, whether OAuth can create accounts | Auth flow + negative tests |
| **Testing** | Tests that would catch the regression | Write tests that create real rows and assert exact values; **demonstrate the test failing before the fix** | Ask "what would this test miss?" Reject vacuous assertions | Named tests + a proven-to-fail note |
| **Debugging** | Root cause, not symptom suppression | Reproduce first; read the actual error and the actual query; explain the mechanism before proposing a fix; add a regression test | Supply the real error text, logs, environment and steps. Reject any fix whose mechanism you don't understand | Root-cause statement + fix + regression test |
| **Refactoring** | Same behaviour, better structure | Refactor in a commit that changes **no** behaviour, with tests passing before and after; never bundle with a feature | Decide it is worth it now. Most refactors are not | Behaviour-neutral commit |
| **Code review** | Catch what tests cannot | Review the diff against the plan: unrequested changes, silently deleted behaviour, `TODO`s, secrets, N+1 queries, missing permission checks | Read every diff you will have to support. Non-negotiable | Findings list; fixes as separate commits |
| **Security review** | No unauthorized read or write | Enumerate every new endpoint: authenticated? tenant-scoped? permission-checked? what leaks in the response? Write cross-tenant and wrong-role tests | Decide the risk appetite for sensitive fields; own the encryption and retention policy | Security findings + isolation tests |
| **Performance** | Fast where users feel it | Measure first (query counts, payload sizes, render blocking). Propose the smallest fix — index, eager load, cache with a TTL | Set the budget (this repo: P95 < 250 ms, LCP < 1.5 s). Decide what to optimize | Before/after numbers |
| **Deployment prep** | Deploy that works the first time | Produce an env-var inventory (marking which are build-time), a migration plan, a smoke checklist, a rollback procedure; verify unconfigured integrations degrade cleanly | Hold the secrets. Approve the window. Run the smoke checklist yourself | Runbook diff + release checklist |
| **Production troubleshooting** | Restore service, then prevent recurrence | Read production logs; reproduce locally where possible; smallest safe fix; regression test; then document the gotcha | Decide roll-forward versus roll-back. Communicate to users | Fix + test + gotchas entry |

### The two rules that make this table work

1. **Claude Code proposes; the human disposes — at the seams.** Inside a slice, let it work. At every boundary (architecture, schema, security, deploy), stop and decide.
2. **Verification is part of the deliverable, not a follow-up.** In this repository, features whose commit message contains a specific verification sentence ("driving the real UI…", "on an iPhone 13 viewport…", "two-user conversation…") did not come back as bugs. Features whose commit message describes only what was written did. That correlation is the strongest practical finding in the whole analysis.

---

# 6. The ChatGPT + Claude Code Workflow (Part 4)

**RECOMMENDATION.** No ChatGPT usage is visible in the repository — every commit is co-authored by Claude. Whether ChatGPT was used for thinking is **UNKNOWN**. What follows is designed from what the evidence shows each tool class is good and bad at.

## The wrong model of this

"ChatGPT thinks, Claude builds" is close but misleading, because it implies the thinking finishes before the building starts. In this project the most valuable thinking happened *inside* the build — the tenant-binding security hole was found while implementing payslip PDFs; the compose stack's missing Reverb service was found by auditing infrastructure against shipped features. An agent with the repository in front of it discovers things a chat model cannot.

## The right division: by information access, not by task type

| | **ChatGPT (or any chat model without your repo)** | **Claude Code (agent with repository access)** |
|---|---|---|
| **Sees** | What you paste | Every file, git history, test output, the running app, logs |
| **Best at** | Divergent thinking, market and product reasoning, naming, positioning, pricing, competitor analysis, explaining unfamiliar concepts, drafting user-facing copy, being a second opinion on a plan, rubber-duck debugging when you cannot share code | Anything that requires knowing what the code actually says; multi-file changes; running tests; reproducing bugs; deployment mechanics; verifying claims against reality |
| **Worst at** | Anything requiring ground truth about your codebase. It will confidently describe code it has never seen | Product strategy and taste. It will optimize the thing you pointed it at, whether or not that thing matters |

## Concrete assignments

**Do in ChatGPT:**
- Idea interrogation before there is a repo: who is this for, what breaks without it, what is the smallest useful version
- PRD drafting and challenging (have it argue *against* your scope)
- Competitive positioning, pricing tiers, monetization
- Persona and user-journey exploration
- Naming: modules, roles, permission keys, entities, product copy
- Explaining a concept you must understand before you can supervise it ("what is a BFF and why would I use one?")
- **Plan review:** paste Claude's slice plan and ask "what is missing, what will break, what did this plan assume?"
- **Adversarial spec review:** paste the PRD and ask for the twenty questions a hostile senior engineer would ask
- Deciding *whether* to build something

**Do in Claude Code:**
- All code, migrations, tests, config
- Reading and mapping the existing codebase (never ask a chat model what your code does)
- Running the app and verifying features work
- Debugging with real errors and real logs
- Deployment, CI, infrastructure
- Anything where being wrong about the current state of the repo makes the answer worthless
- Writing the ADR *after* a decision is made, because it has the code to reference

## When information moves — and in which direction

**ChatGPT → Claude Code.** Move *decisions and specifications*, never instructions to "implement what we discussed." Handoff format:

```
Context: <2–4 sentences of what exists>
Goal: <the one capability to add>
Decisions already made: <list — stack, pattern, constraint>
Acceptance criteria: <3–6 checkable statements>
Out of scope: <explicit list>
Constraints: <preserve X, do not touch Y, match convention Z>
```

**Claude Code → ChatGPT.** Move *the shape of the problem*, not the code. Good uses:
- Claude reports three viable architectures; ChatGPT stress-tests them against your business constraints
- Claude reports a bug's root cause; ChatGPT helps you decide whether to fix, defer, or redesign
- Claude reports what a module now does; ChatGPT drafts the release notes, help-centre article, or sales copy
- Claude reports a bug pattern that recurred; ChatGPT helps you turn it into a rule for your own methodology

Do **not** move code from Claude to ChatGPT for review. ChatGPT reviewing a pasted file lacks the callers, the tests, and the conventions — it will produce plausible, confident, context-free suggestions. Review code in the tool that can see the repository.

## What must never be fully delegated to any AI

1. **What to build and for whom.** AI will build whatever you point at, beautifully, including the wrong thing. Evidence: 16 modules exist; the roadmap's suggested next sprint is still "provision hosting, connect keys" — breadth outran depth because nothing stopped it.
2. **Money and law.** Tax computation, invoicing, payroll, retention periods, consent. AI can implement; a human must own the numbers. This repo did this right: PAYE tests pinned to hand-computed values.
3. **Security boundaries.** Who may see what. AI is good at implementing a permission model and bad at knowing that showing an employee company headcount is a breach. Evidence: `ad5342a` — two dashboard endpoints had no permission check at all.
4. **Destructive operations.** Production data deletion, `migrate:fresh`, force-pushes, dropping columns, rotating keys. Human hands, every time.
5. **The final "is this good enough to charge for?" judgement.** Taste is not delegable. Every quality gap fixed on 2026-08-04 and 08-10 was found by a human using the product, not by a test.
6. **Accepting a fix you do not understand.** If you cannot explain why it works, you cannot maintain it, and you cannot tell whether it worked.

## How the developer stays in control

Six mechanisms, all cheap:

1. **One slice per pull request.** 22 PRs here, each one module or one fix. Reviewable is the point.
2. **Plan before code, always.** Approve the slice list; approve slice one; do not approve slices two through eight in advance.
3. **Read every diff you will have to support.** Not skim.
4. **Make the AI show its work.** "What did you verify, and how?" — the strongest predictor of a feature staying fixed in this repo.
5. **Keep the specification in the repo and diff it.** When code and doc disagree, one of them is a bug.
6. **Own the checkpoints.** Green CI, a tag, a database backup — before anything risky.
---

# 7. The VIBE TO PRODUCTION™ Framework (Part 5)

**RECOMMENDATION.** Eleven phases. The ordering is not the one in the original brief — it is the one this project's history argues for, with three deliberate changes:

- **Deployment moves to Phase 3, not Phase 9.** Deploy an empty application before writing feature one. Every deployment surprise in this repo (PHP version, missing extension, seeders that never run, triggers that do not exist, build-time env vars) would have cost minutes on an empty app instead of days on a full one.
- **A dedicated Identity/Tenancy/Permissions phase before features.** The tenant-binding leak and the employee-sees-admin-dashboard bug both trace to permission and scoping work being distributed across feature slices rather than settled first.
- **A Hardening phase that includes a documentation-drift audit.** Because in this repo the specification and the code silently diverged, and nothing was watching.

```
0  IDEA           →  1  PRD            →  2  ARCHITECTURE   →  3  FOUNDATION+DEPLOY
                                                                      ↓
10 OPERATE        ←  9  LAUNCH         ←  8  POLISH         ←  7  HARDEN
                                                                      ↑
                     4  DESIGN SYSTEM  →  5  IDENTITY       →  6  SLICE LOOP ⟳
```

Phase 6 is a loop. Phases 7–8 are also loops in practice. Everything before Phase 6 happens once.

---

## PHASE 0 — IDEA INTERROGATION

**Objective.** Establish that the thing is worth building, for whom, and what the smallest useful version is — before any document is written in the voice of certainty.

**Inputs.** One sentence of ambition. Knowledge of the users (yours, or someone you can talk to).

**AI tasks.** Interrogate rather than agree: who has this problem today, what do they use instead, what breaks if they keep using it, which single workflow must be excellent for the product to be adopted, what is the smallest version a real user would pay for, what makes this hard, what would make it fail. Produce a competitor table with a named weakness per competitor. Draft 4–6 personas as *jobs*, not demographics.

**Human tasks.** Answer honestly. Name the market. Name the wedge — the one thing you will do better than anyone (here: Nigerian payroll and identity compliance). Name what you will *not* build.

**Deliverables.** A one-page brief: problem, users, wedge, non-goals, the one workflow that must be excellent.

**Validation.** You can say in one sentence who this is for and what it replaces, and you can name at least three things you are deliberately not building.

**Common mistakes.** Letting the AI agree with you (it will). Confusing a feature list with a product. Skipping non-goals — the single cheapest scope-control device there is. This repo wrote them down (`docs/01-prd.md` §9: no on-premise, no native desktop, no audit-grade general ledger) and it held.

**Claude Code prompt.**
> I have no repository yet. Act as a skeptical product engineer. My idea: `<one sentence>`. Interrogate it: who has this problem today, what do they use instead, what specifically breaks, what is the smallest version someone would pay for, what makes this technically hard, and what is the most likely reason it fails. Then give me the three questions I am avoiding. Do not write any code or documents yet.

**ChatGPT prompt.**
> You are a product strategist who has killed more products than you have launched. My idea: `<one sentence>`. Give me: (1) the four most likely buyer personas as jobs-to-be-done, (2) a competitor table with each competitor's specific weakness, (3) the wedge — the one capability that would make someone switch, (4) the five things I should refuse to build in v1, and (5) the strongest argument that this should not be built at all.

---

## PHASE 1 — PRODUCT DEFINITION (PRD + SRS)

**Objective.** Convert the brief into a written contract that code can be checked against.

**Inputs.** Phase 0 brief. Any domain rules you know (compliance, approval chains, statutory requirements).

**AI tasks.** Draft the PRD (vision, metrics with numbers, personas, positioning, module table with an explicit **MVP column**, cross-cutting requirements, monetization, non-goals, release plan, risks with mitigations) and the SRS (numbered functional requirements with M/S/C priority, non-functional requirements with measurable targets, constraints, acceptance criteria). Draft user-journey diagrams for the 5–7 flows that matter. Then, in a separate pass, *attack* its own document: what is ambiguous, what conflicts, what is unimplementable at this budget.

**Human tasks.** Cut the MVP column ruthlessly. Set the numbers (latency, uptime, price). Approve business rules — approval chains, retention periods, who may see salary. Decide what is a hard requirement versus an aspiration, and **label the aspirations as such**.

**Deliverables.** `docs/01-prd.md`, `docs/02-srs.md`, `docs/10-user-flows.md`. Requirement IDs (`FR-AUTH-1`) that later commits and tests can cite.

**Validation.** Every MVP requirement is checkable — a person could look at the running app and say yes or no. Every non-functional target has a number. Nothing in the document is a claim you have no intention of implementing this quarter.

**Common mistakes.**
- **Aspiration laundered as specification.** Observed here: PHPStan level 8, Trivy, gitleaks, Dependabot, Sentry, annual pentest, RLS, ≥80% coverage, E2E in CI — all in the docs, none in the repo. The document loses authority the moment it contains one unenforced claim.
- Requirements without IDs, so nothing can cite them.
- A 14-module scope with no MVP split (this project avoided that, and it is why the scope survived).

**Claude Code prompt.**
> Using `docs/00-brief.md`, draft a PRD and an SRS. PRD: vision, success metrics with numeric targets, personas as jobs, competitive positioning with named weaknesses, a module table with a strict MVP-vs-later split, cross-cutting requirements, pricing, non-goals, release plan, risk table. SRS: numbered functional requirements (`FR-<AREA>-<n>`) each tagged M/S/C, plus measurable non-functional requirements. Two rules: mark anything you are inferring rather than taking from the brief, and put anything we cannot enforce in a clearly-labelled "Aspirations (not yet enforced)" section rather than mixing it into the requirements.

**ChatGPT prompt.**
> Here is my PRD: `<paste>`. Act as a hostile senior engineer in a scoping review. Give me the twenty questions you would ask, the five requirements that are secretly three requirements each, the three that will be far more expensive than they look, and the two that should be cut entirely.

---

## PHASE 2 — ARCHITECTURE & DECISIONS

**Objective.** Fix the small number of decisions that are expensive to reverse, and write down *why*.

**Inputs.** PRD, SRS, your constraints (budget, team, existing skills, hosting preference).

**AI tasks.** For each decision, present 2–3 options with trade-offs and a recommendation: monolith vs services; multi-tenancy model; database engine; frontend framework and rendering strategy; how the browser authenticates (direct-to-API vs BFF); state management; real-time transport; queue and worker topology; file storage; deployment target. Then produce the ERD, folder structure, API conventions (envelope, status codes, pagination, filtering, errors), permission naming scheme, and an ADR per decision.

**Human tasks.** **Choose.** These are business decisions disguised as technical ones — they determine hosting cost, hiring pool, and how fast you can move in month six. Also decide the *cost of being wrong* for each; that tells you how much to deliberate.

**Deliverables.** `docs/03-architecture.md`, `docs/04-database-schema.md` with an ERD, `docs/05-api.md` with conventions, and short ADRs.

**Validation.** You can explain each decision and its main alternative in two sentences. The API conventions document is specific enough that two people would write the same endpoint the same way.

**Common mistakes.**
- **Specifying a structure nobody implements.** Observed here in detail: the architecture doc specifies per-module `Requests/`, `Repositories/`, `DTOs/`, `Policies/`, `Events/`, `routes.php` and migrations; the code has none of these — 0 FormRequests, 0 Repositories, 0 Policies, 82 inline `validate()` calls, one 400-line routes file, one flat migrations directory, 60 flat models. Prescribe only what you will enforce in review.
- Choosing microservices because they sound scalable. This project chose a modular monolith explicitly, documented the reason, and preserved an extraction path. Correct call.
- Deciding the folder structure and never checking commit 3 against it. **Do this check.**

**Claude Code prompt.**
> Read `docs/01-prd.md` and `docs/02-srs.md`. Propose an architecture. For each of these decisions give me 2–3 options, the trade-offs, and your recommendation with reasoning: application topology, multi-tenancy model, database, frontend framework and rendering strategy, browser-to-API auth, state management, real-time transport, background jobs, file storage, hosting. Do not write code. Where a decision depends on something only I know (budget, team, compliance), ask instead of assuming. End with the three decisions that would be most expensive to reverse.

**ChatGPT prompt.**
> Here are the architecture decisions my engineer proposes: `<paste summary>`. My constraints: `<budget / team size / skills / expected scale>`. Which of these will I regret, and at what point? Which are over-engineered for my actual scale? Which single decision most limits my ability to change direction in six months?

---

## PHASE 3 — FOUNDATION AND FIRST DEPLOY

**Objective.** A deployed, publicly reachable, near-empty application with green CI, before feature one exists.

**Inputs.** Architecture decisions. A hosting account. A domain (or a platform-provided subdomain).

**AI tasks.** Scaffold framework skeletons; write the shared kernel (tenancy, module registry, API base controller, error envelope) **with its own tests**; write CI running lint, typecheck, build and tests **against the same database engine as production**; write the Dockerfiles or platform config; deploy; get a health endpoint answering over HTTPS; write the first draft of the deployment runbook including an environment-variable inventory that marks which values are baked in at build time.

**Human tasks.** Create the accounts. Hold the secrets. Buy the domain. Run the deploy yourself once, following the runbook, and fix the runbook where it lies.

**Deliverables.** Live URL returning a health check. Green CI on every push. A runbook. An env-var inventory. `.gitignore` covering `.env*` with an `!.env.example` exception.

**Validation.** You pushed a trivial change and it appeared in production without manual steps. `curl https://api.<domain>/up` returns 200. CI is red when a test fails.

**Common mistakes.** This is where the evidence is densest, so this list is entirely observed:
- **Scaffolding in one 25,616-line commit.** Nobody reviews that. Its accidental choices become your architecture. Split into three reviewable commits.
- **Testing on a different database engine than production.** SQLite in CI, Postgres in prod, and a production 500 as a direct result.
- **Assuming the platform runs your seeders.** It does not. If a permission row must exist in production, ship it as a migration.
- **Assuming a connected repo means auto-deploy.** Four of five services here had a repo source and no branch trigger, and drifted three days behind main — the worker was missing notification classes the API was dispatching to it.
- **Assuming runtime env vars reach the frontend bundle.** `NEXT_PUBLIC_*` inline at build time. Runtime values are silently ignored.
- **Loose version constraints.** `"php": "^8.2"` with a lockfile requiring 8.4.1 → the platform picked 8.2 and the build failed. Pin to what your lockfile actually needs.
- **Assuming native extensions exist.** Reverb needs `ext-pcntl`; declare it in `composer.json` or the platform will not install it.

**Claude Code prompt.**
> Set up the foundation from the decisions in `docs/03-architecture.md`, in three separate reviewable commits: (1) framework skeletons + CI running lint, typecheck, build and tests against `<production database engine>`; (2) the shared kernel — tenancy scoping, module registry, API base controller and error envelope — with tests; (3) deployment config for `<platform>`. Then walk me through deploying it and write `docs/deployment.md` as we go, including an environment-variable table that marks which variables are build-time-only. Stop after each commit for review. Assume nothing about the platform: check what it runs automatically versus what I must run once.

**ChatGPT prompt.**
> I am deploying a `<stack>` app to `<platform>` for the first time. What are the failure modes people hit on this exact combination in their first week — version resolution, missing extensions, build-time versus runtime configuration, what the platform does and does not run automatically? Give me a pre-flight checklist.

---

## PHASE 4 — DESIGN SYSTEM AND APP SHELL

**Objective.** Make every later screen a fill-in rather than a design decision.

**Inputs.** Brand (colors, typeface, voice). The quality bar, stated as references.

**AI tasks.** Build semantic design tokens as CSS custom properties with light and dark values; verify contrast; wire the theme switcher; build the app shell (sidebar, topbar, mobile drawer, command palette); build the primitive set (button, input, select, dialog, card, table, badge, avatar, skeleton, empty state, toast); write a component gallery page; create **permission- and module-filtered navigation from a single shared config**; create placeholder pages for every planned module so the information architecture is real.

**Human tasks.** Set the quality bar by reference, not adjective — this project's design doc names Linear, Notion, Stripe, Vercel, Framer, Apple, Arc, Clerk, and says "never admin template." Judge the shell on a real phone. Approve the token palette.

**Deliverables.** `globals.css` tokens, `components/ui/*`, app shell, one nav config consumed by desktop and mobile, placeholder pages, a design-system document.

**Validation.** A new page can be built from primitives without inventing a color, a radius or a spacing value. Light and dark both pass contrast. The shell works one-handed on a phone.

**Common mistakes.**
- **Building the shell desktop-only.** Observed: the sidebar was hidden below `lg` with *nothing in its place*, so for weeks there was no navigation at all on a phone — "every page was reachable only by typing a URL, and the dashboard was the whole product." Build the mobile shell in the same slice as the desktop shell.
- **Two navigation lists.** The fix here explicitly unified them: "The nav list and its filtering now live in one module that both consume, so the two cannot drift apart."
- **Declaring dependencies you never use.** `framer-motion` and `zustand` are in `package.json` and imported nowhere in `src`, while the design document specifies a full motion system. Either build it or drop the dependency.
- **Forgetting mobile input sizing.** iOS Safari zooms the viewport on any focused input under 16px. It cost a real bug on the invitation page.

**Claude Code prompt.**
> Build the design system and app shell from `docs/06-design-system.md`. Semantic CSS custom-property tokens with light and dark values (verify WCAG AA contrast and report the ratios); the primitive components; the app shell with sidebar, topbar **and** a mobile drawer built in this same pass; one shared navigation config, filtered by permission and enabled module, consumed by both; placeholder pages for every module in the PRD; and a `/gallery` page showing every component in every state including loading, empty and error. Form controls must be at least 16px on mobile and touch targets at least 44px. Then screenshot the shell at 390px and 1440px and show me.

**ChatGPT prompt.**
> My product is `<description>` for `<users>`. I want it to feel like `<2–3 reference products>`. Give me a concrete visual specification: palette with hex values and their semantic roles, type scale with sizes/weights/tracking, spacing scale, radii, shadow steps, and motion timings. Then tell me the five details that separate products that look premium from products that look like admin templates.

---

## PHASE 5 — IDENTITY, TENANCY AND PERMISSIONS

**Objective.** Settle who someone is, which organization's data they can touch, and what they may do — before any feature relies on it.

**Inputs.** Role list and permission model from the PRD. Tenancy decision from Phase 2.

**AI tasks.** Registration, login, logout, password reset; the session mechanism (here: BFF with an HttpOnly cookie so the browser never holds an API token); 2FA; OAuth if needed, with an explicit decision on whether it may *create* accounts; invitations with hashed single-use tokens and expiry; tenant scoping applied automatically at the ORM layer with auto-fill on create; **middleware ordering verified** so tenant context binds before route-model binding; permission catalogue with `module.resource.action` naming; role seeding; a single authorization helper; a bootstrap endpoint returning user, tenant, enabled modules, permissions and unread counts so the client can render itself. Then write the adversarial tests: cross-tenant id, wrong role, expired token, replayed code, missing permission, session held by someone else.

**Human tasks.** Decide the policy — who may see salary, whether OAuth creates accounts (here: no, sign-in only), session lifetime, whether 2FA is enforced. Decide which fields are encrypted at rest. Personally attempt to access another tenant's data.

**Deliverables.** Working auth, tenant scoping, permission catalogue, role seeds, bootstrap endpoint, isolation tests.

**Validation.** A test proves a valid token from tenant A cannot read tenant B — by id, by route-model binding, by search, by report, and by websocket channel. A test proves a plain employee gets 403 on every admin endpoint.

**Common mistakes.**
- **Middleware ordering.** The exact bug: route-model binding ran *before* tenant context was bound, so bound models resolved unscoped and a cross-tenant id could leak. Fixed by declaring explicit middleware priority. This class of bug is invisible to code reading and only caught by a test that uses token auth in production's middleware order.
- **Permission checks on some endpoints and not others.** Two dashboard endpoints here had none, exposing company headcount, department breakdown, birthdays and the leave queue to any member.
- **Client-side gating mistaken for security.** This repo gets the framing right in a code comment: the client filter "only keeps people from being shown doors they cannot open" — the API enforces every rule. Both are needed; only one is security.
- **Shipping permissions as seed data.** Deployment runs migrations, not seeders. A permission that only exists in a seeder does not exist in production.
- **404 vs 403 leaking existence.** Cross-tenant lookups should 404.

**Claude Code prompt.**
> Implement identity, tenancy and permissions per `docs/03-architecture.md` §2.2 and `docs/07-security.md`. Include: registration and login, session handling via `<mechanism>`, invitations with hashed single-use expiring tokens, automatic tenant scoping at the ORM layer with auto-fill on create, and a `module.resource.action` permission catalogue with role seeds shipped as a **migration** so deployment picks it up. Verify middleware ordering so tenant context is bound before route-model binding — write a token-auth test that proves a cross-tenant id fails, and show me that test failing against the unordered version first. Then write negative tests for: wrong role, expired token, cross-tenant search, cross-tenant websocket channel auth, and an employee hitting every admin endpoint.

**ChatGPT prompt.**
> My app has these roles: `<list>`. For each role, list what they must be able to see, what they must never see, and the three mistakes most products make with that role. Then give me the permission list I am missing.

---

## PHASE 6 — THE VERTICAL SLICE LOOP ⟳

**Objective.** Ship one complete, usable, tested capability at a time. This is where most of the calendar time goes and where discipline pays or costs the most.

**Inputs.** The slice's requirement IDs from the SRS. Existing conventions. The current test suite, green.

**AI tasks per slice.** Migration → model with tenancy trait → service if there is real logic → controller with validation and permission checks → routes with module gating → permission seeds as a migration → frontend page, dialogs and states (loading, empty, error) → navigation entry → feature tests that create real rows and assert exact values → run the app and use the feature → report exactly what was verified and how. Update the API document and roadmap in the same commit.

**Human tasks.** Approve the slice before it starts. Then **use the feature** and ask the two questions that found almost every gap in this repository:
1. *Can every field the API accepts be set from a screen?*
2. *Can a real user complete the whole job, or only the step I just built?*

Review the diff. Merge one slice per pull request.

**Deliverables.** One commit (or tight PR) containing all layers, tests, docs and navigation. A running test count in the commit message.

**Validation.** Suite green and larger. You performed the user's job in the browser, on desktop and phone. The commit message states what was verified. Nothing unrelated changed.

**Common mistakes.** Every item below is a real bug from this repository:
- **API/UI drift.** Tasks accepted `description` and `assignee_ids` from day one; no form could set them, so "every task fell silently to whoever created it and carried no detail beyond its title."
- **Engine with no input path.** Payroll could never run because nothing could set a salary.
- **Seeded-once configuration.** Leave types read-only, so "a workspace was stuck with whatever it started with." Work schedules had no editor, so late detection "was therefore inert for every real customer."
- **A page with no door.** Roles and permissions existed and worked; nothing in navigation pointed at it, "which is why it read as missing."
- **Vacuous tests.** A counter test that never created the row it counted, so it passed against a query referencing a non-existent column.
- **Component-level bugs fixed at one call site.** Dialogs could not scroll — 1,247px of content in a 766px window with the save button unreachable. Fixed on the Dialog component, "rather than one caller, since every dialog in the app had the same ceiling." Fix the shared component.
- **Flaky test built from two independent anchors.** `next('Monday')` and `next('Tuesday')` computed separately, so the suite failed only when run on a Monday. Derive related dates from one anchor.

**Claude Code prompt (the workhorse — use this one most).**
> Implement one slice: `<capability>`, satisfying `<FR-IDs>`. Before writing code, tell me: the files you will create or change, the schema change, the permissions involved, the endpoints, the screens, and the tests you will add — then wait for my go-ahead.
>
> When building, follow existing conventions exactly (validation, error envelope, permission checks, tenancy scoping, component primitives). Every field the API accepts must be settable from a screen. Every default you seed must have an editor. The page must appear in navigation, permission-filtered. Include loading, empty and error states.
>
> Tests must create real rows and assert exact values — no assertion that would pass against an empty table. Ship permission changes as migrations, not seeder edits.
>
> Then run the app, complete the user's whole job through the UI on desktop and a 390px viewport, and report what you verified and how. Touch nothing outside this slice; if you find an unrelated bug, tell me instead of fixing it.

**ChatGPT prompt.**
> For a `<domain>` feature — `<capability>` — list the business rules a first implementation usually misses: edge cases, states, permission subtleties, and the "who can undo this" question. Then give me the acceptance criteria a picky operations manager would demand.

---

## PHASE 7 — HARDENING

**Objective.** Close the gaps that feature work cannot see, including the gap between your documents and your code.

**Inputs.** A feature-complete MVP. The SRS non-functional requirements. The security document.

**AI tasks.**
- **Security sweep:** enumerate every endpoint — authenticated? tenant-scoped? permission-checked? what does the response leak? Write cross-tenant and wrong-role tests for each. Check file upload validation, rate limits on auth, webhook signature verification, secrets absent from the repo, debug mode off in production, and what appears in audit logs (fields, never values, for encrypted columns — this repo gets that right).
- **Performance sweep:** query counts per endpoint (N+1), missing indexes on the tenant-scoped composite paths, unpaginated list endpoints, payload sizes, blocking render paths.
- **Drift audit — do this explicitly:** produce a table of every claim in the docs against its evidence in the code, and mark each ✅ implemented / ⚠️ partial / ❌ absent. Then either implement it or move it to a labelled aspirations section.

**Human tasks.** Decide what ships unfixed and write that down. Approve the risk. Try to break your own permission model.

**Deliverables.** Isolation and negative tests, an index/pagination pass, a drift table, an honest roadmap.

**Validation.** No endpoint is unauthenticated by accident. Every list endpoint that can grow is paginated. Every doc claim is implemented or labelled.

**Common mistakes.** Skipping this phase because features "work." Observed drift when it is skipped, all confirmed in this repo: no Sentry despite NFR-7; no PHPStan despite a claimed level-8 gate; no gitleaks, Trivy or Dependabot despite a named CI gate; no Postgres RLS despite it being described as a "second, database-enforced wall"; no idempotency keys despite the API contract advertising the header; no OpenAPI generation; only **3 of ~60 list endpoints paginated** despite NFR-8 saying "all list endpoints paginated"; no `Auditable` trait (audit writes are 71 explicit call sites — which works, but means a new endpoint silently forgets to audit).

**Claude Code prompt.**
> Hardening pass, three deliverables, no feature work.
> 1. **Security:** table every endpoint in `routes/api.php` — auth required, tenant-scoped, permission checked, sensitive fields in the response. Flag every gap. Write failing tests for the real gaps before fixing them.
> 2. **Performance:** report query counts and payload sizes for the ten heaviest endpoints, list unpaginated list endpoints and missing composite indexes, and propose the smallest fixes.
> 3. **Drift audit:** every claim in `docs/` about tooling, testing, security and performance, against what is actually in the repo. One table, marked implemented / partial / absent. Do not fix the docs yet — show me first.

**ChatGPT prompt.**
> My app handles `<data types>` for `<users>` in `<jurisdiction>`. What are the obligations I am likely unaware of — retention, consent, breach notification, access rights — and which of them change how I must build, not just what I must write in a policy?

---

## PHASE 8 — PRODUCTION POLISH

**Objective.** Move from "it works" to "it is worth paying for."

**Inputs.** The hardened MVP. A real device. The production-quality checklist (§13).

**AI tasks.** Walk every screen and fix: loading skeletons instead of spinners, empty states that teach, error states that say what to do next, form validation with field-level messages mapped from API errors, confirmation on destructive actions (typed-name confirmation for irreversible ones), disabled controls that explain themselves, keyboard focus rings, 44px touch targets, 16px mobile inputs, tables that scroll in their own container rather than the page, dialogs that scroll, dates humanized, currency formatted, sentence-case copy. Then screenshot every screen at 390px and 1440px in light and dark.

**Human tasks.** Use the product as each persona for ten minutes on a real phone. Note everything that feels wrong, including things you cannot articulate — that list is the polish backlog. Judge whether you would pay for it.

**Deliverables.** A polished pass over every screen. Screenshots. A remaining-rough-edges list.

**Validation.** No horizontal page overflow at 390px on any screen. Every list has an empty state. Every destructive action confirms. Every form field can show an error. Nothing shows a spinner during navigation.

**Common mistakes.** All observed here: a disabled button with no explanation ("a dead button reads as a broken page, especially once the placeholder has disappeared behind what you typed"); content unreachable inside an unscrollable dialog; tables wrapping an employee code across two lines; a seven-column calendar squeezing cells to ~50px; a theme switcher unreachable on mobile; treating polish as cosmetic when in this project it was the difference between "shipped" and "usable."

**Claude Code prompt.**
> Production-polish pass on `<page or module>`. For every screen: skeleton loading (never a navigation spinner), an empty state that teaches, an error state that says what to do next, field-level validation mapped from API error fields, confirmation on destructive actions, no disabled control without an explanation, visible focus rings, 44px touch targets, 16px form controls below `sm`, wide content scrolling in its own container, scrollable dialogs, humanized dates, formatted currency, sentence case. Then drive the app and screenshot every screen at 390px and 1440px in light and dark, and report anything that overflows or is unreachable. Fix shared components rather than individual call sites when the problem is shared.

**ChatGPT prompt.**
> Here is a description of my `<screen>`: `<paste>`. What would a designer at `<reference product>` change first? What states have I forgotten? What copy is written for me rather than for the user?

---

## PHASE 9 — LAUNCH

**Objective.** Real users on a real domain, with a way back if it goes wrong.

**Inputs.** Polished app. Domain. Production secrets. Backups verified.

**AI tasks.** Final env-var inventory including build-time values; migration plan; smoke checklist; rollback procedure; monitoring and uptime checks; verify third-party callbacks (OAuth redirect URIs, payment webhooks) against production URLs; confirm unconfigured integrations degrade cleanly; write the launch runbook.

**Human tasks.** Own DNS, TLS and secrets. **Test a restore from backup before launch, not after.** Run the smoke checklist yourself. Decide the rollback trigger in advance ("if X, we roll back") so you are not deciding it while stressed.

**Deliverables.** Live product on your domain. Verified smoke run. Working rollback. Monitoring alerting to a human.

**Validation.** You completed the full user journey on production from a phone on mobile data. A restore has been tested. You know exactly how to roll back and have done it once in staging.

**Common mistakes.** Launching with a page that links to a route nobody built (this repo shipped a login page linking to `/register`, which 404'd on production). Discovering SMTP is not configured after inviting real users (handled here by *also* returning a shareable setup link — a genuinely good fallback). Never testing a restore.

**Claude Code prompt.**
> Pre-launch review. Produce: (1) a complete environment-variable inventory for every service, marking build-time-only values; (2) the migration plan and its rollback; (3) a smoke checklist covering signup, login, 2FA, the core workflow, file upload, email, background jobs, real-time, and payment in test mode; (4) verification that every third-party callback URL matches production; (5) confirmation that each unconfigured integration degrades cleanly rather than erroring; (6) a rollback procedure I can execute in five minutes. Then crawl every route in the app and report any link pointing at a page that does not exist.

**ChatGPT prompt.**
> I am launching `<product>` to `<first users>` tomorrow. What goes wrong in the first 48 hours of a launch like this, in order of likelihood, and what should I have prepared for each?

---

## PHASE 10 — OPERATE AND ITERATE

**Objective.** Keep it running, keep it improving, without losing the discipline that got it here.

**Inputs.** Production logs, user feedback, monitoring, the deferred-work list.

**AI tasks.** Triage incoming issues into: production incident, bug, usability gap, missing feature. Reproduce before fixing. Root-cause, fix, add the regression test, and **write the gotcha down** if it was environmental. Keep the roadmap honest. Keep dependencies current one at a time.

**Human tasks.** Prioritize. Talk to users. Decide what not to fix. Protect the slice discipline — post-launch is where "just add it quickly" destroys codebases.

**Deliverables.** Fixes with regression tests. An updated gotchas document. An honest roadmap. Verified backups.

**Validation.** Every production bug produced a test that would have caught it. The suite still grows. The roadmap still matches reality.

**Common mistakes.** Fixing symptoms; skipping the regression test because "it's obvious now"; not writing down environmental gotchas (this repo explicitly reversed that: *"Two things cost real debugging time on this deployment and neither was written down"*).

**Claude Code prompt.**
> Production issue: `<symptom>`. Environment: `<prod/staging>`. Here is the error and surrounding log: `<paste>`. Steps: `<paste>`.
> Do not propose a fix yet. First: reproduce it locally or explain precisely why you cannot, then explain the mechanism — what the code does, what it should do, and why the difference produces this symptom. Then tell me the smallest safe fix and what it risks. Then write a test that fails against current code, show me it failing, apply the fix, show it passing. If the cause is environmental rather than in our code, add it to `docs/gotchas.md`.
---

# 8. Idea to PRD (Part 6)

**RECOMMENDATION**, modelled on how `docs/01-prd.md` and `docs/02-srs.md` are actually constructed.

## The worked example

Start: *"I want to build a school management system."*

That sentence contains no product. It contains a category. Six passes turn it into a specification.

### Pass 1 — Find the problem, not the category
Ask what breaks today. Not "schools need software" but: *the bursar reconciles fees in a notebook and parents dispute balances; attendance is on paper so nobody knows a child stopped coming until the third week; report cards take two weeks of teacher evenings and arrive with arithmetic errors.*

Now you have three candidate products. Pick the one where the pain is sharpest and the buyer is the one feeling it. **That is the wedge.** Go3net Office's wedge is visible in the PRD: not "HR software" but Nigerian statutory compliance — NIN, BVN, PAYE, pension — which is why the payroll engine has versioned tax tables and encrypted identity columns while the LMS has no quizzes.

**Human decision. AI cannot pick your wedge.**

### Pass 2 — Name the users as roles with jobs
Not demographics. Jobs. This project's format:

> **HR Manager (Tunde)** — runs recruitment → onboarding → attendance → leave → payroll → exit. Needs Nigerian compliance (NIN, BVN, PAYE, pension) and document generation.

Every persona is a *workflow*, and each is mapped to a role in the permission system. For the school: Head Teacher (sees everything, decides), Bursar (fees, receipts, arrears), Class Teacher (attendance, grades for their class only), Parent (their children only, fees and results), Student (timetable, assignments), Registrar (admissions, records).

Rule of thumb: if two personas need different permissions, they are different roles. If they need the same permissions, they are one role.

### Pass 3 — Modules, with an MVP column
List the functional domains, then split each into "v1" and "later." The split is the whole point — this project's PRD calls the MVP column "the contract."

| Module | MVP (v1) | Later |
|---|---|---|
| Students | Profiles, enrolment, classes, guardians | Documents, medical, transfers |
| Attendance | Daily register per class, absence flag | Biometrics, parent SMS, analytics |
| Fees | Fee structure, invoices, payments, arrears list | Instalment plans, online payment, scholarships |
| Grades | Assessment entry, term report card PDF | Weighted schemes, transcripts, analytics |
| Timetable | View by class and teacher | Automatic generation, room conflicts |
| Communication | Announcements to parents | Two-way messaging, WhatsApp |

### Pass 4 — Business rules (where the real specification lives)
This is the pass everyone skips and it is the pass that determines whether the software is usable. Rules are statements a domain expert would recognize:

- A class teacher may only mark attendance for their own class, and only for today or yesterday.
- A fee invoice cannot be edited after a payment is recorded against it; it can only be credited.
- A report card cannot be published until every subject teacher has submitted grades.
- A student cannot be deleted, only withdrawn, and withdrawal preserves the fee history.
- Only the bursar may reverse a payment, and every reversal is audited with a reason.

Go3net Office's equivalents are visible in code and are the best parts of it: an exit cannot complete until every clearance task is done **and** no assets are still assigned; a leave type cannot be deleted once staff have booked against it "since that would strand their history"; a payroll item can only be adjusted while the run is in draft; a department with staff attached cannot be deleted "so nobody is silently orphaned"; deleting an employee requires typing their employee code.

**Ask the AI to generate candidate rules, then have a human confirm each one.** AI is good at proposing the shape of a rule and bad at knowing your institution's actual policy.

### Pass 5 — Derive the rest from the above
Once problem, roles, modules and rules exist, the following *follow* and can largely be AI-drafted:

- **Permissions** — one per rule boundary, named `module.resource.action`: `fees.invoice.manage`, `attendance.register.mark`, `grades.report.publish`.
- **User journeys** — one diagram per critical path (enrol a student, collect a fee, publish a report card). Go3net has seven of these in `docs/10-user-flows.md`, and they double as end-to-end test scripts.
- **Database requirements** — entities, relationships, which columns are sensitive (encrypted) and which are financial (never hard-deleted).
- **Notifications** — one per state change that a human is waiting on, with channel and recipient.
- **Reports** — what must be exportable and in what format.
- **Integrations** — payment provider, SMS gateway, email.
- **Security requirements** — what must be encrypted, retained, audited, and for how long.
- **Performance requirements** — as numbers, in the user's terms ("a class register loads in under a second on a school's 3G connection").
- **Future features** — parked explicitly, so they stop being argued about.

### Pass 6 — Attack the document
Have a chat model play hostile reviewer against the PRD. Then cut. A 14-module PRD is only survivable with a hard MVP column, and this project proves both halves of that: the split held the scope, and the breadth still outran depth (16 module UIs exist; several are one screen deep).

---

## Reusable PRD template

```markdown
# <Product> — Product Requirements Document
**Version:** 0.1 · **Owner:** <name> · **Status:** Draft | Approved for build
**Last reviewed:** <date>

## 1. Problem
What breaks today, for whom, in their words. Two paragraphs maximum.

## 2. Vision & one-line pitch
What the world looks like when this works. One sentence someone could repeat.

## 3. Wedge
The one thing we do better than every alternative. If we do only this, we still have a product.

## 4. Goals & success metrics
| Goal | Metric | Target | By when |

## 5. Users & personas
For each: name, role, the job they are trying to finish, their device and context,
what they must never see.

## 6. Competitive positioning
| Alternative | What they do well | Their specific weakness | Our advantage |

## 7. Product principles
3–6 statements that settle future arguments. Each must be capable of losing an argument.

## 8. Modules & scope
| # | Module | MVP (v1) — THE CONTRACT | Later (v2+) | Never |

## 9. Business rules
Numbered, unambiguous, each one a statement a domain expert would confirm.
BR-1 …

## 10. Roles & permissions
| Role | Can | Cannot | Notes |
Permission keys: <module>.<resource>.<action>

## 11. User journeys
One diagram or numbered flow per critical path. These become the E2E test scripts.

## 12. Data requirements
Key entities and relationships. Mark: 🔒 encrypted at rest · 💰 never hard-deleted ·
📜 audit every change · ⏳ retention period.

## 13. Notifications
| Event | Recipients | Channels | Urgency |

## 14. Reports & exports
| Report | Audience | Format | Filters |

## 15. Integrations
| Service | Purpose | Failure behaviour when unconfigured |

## 16. Security & compliance requirements
Authentication, authorization, encryption, audit, retention, jurisdiction.

## 17. Performance requirements
As numbers, in user terms. Device and network assumptions stated.

## 18. Accessibility & platform requirements
Standard targeted, browsers, minimum device, offline behaviour.

## 19. Non-goals (v1)
The most valuable section in the document. Be specific and slightly painful.

## 20. Release plan
| Version | Contents | Gate to ship |

## 21. Risks
| Risk | Likelihood | Impact | Mitigation | Owner |

## 22. Aspirations (NOT yet requirements)
Everything we intend but are not enforcing. Dated. Nothing here may be cited as a
requirement, and nothing above may live here.

## 23. Open questions
| Question | Blocks what | Owner | Needed by |
```

Sections 22 and 23 are the additions this project's history argues for hardest. Section 22 exists because `docs/07-security.md` mixed aspiration into requirement and nobody could tell which was which. Section 23 exists because unresolved questions otherwise get silently resolved by whoever writes the code.

---

# 9. From PRD to Architecture (Part 7)

**RECOMMENDATION.** The transformation is mechanical for some outputs and judgement-heavy for others. Know which is which.

## What the AI can derive from the PRD

| Output | Derived from | How mechanical |
|---|---|---|
| Entity list and ERD | §12 data requirements + §9 business rules | Mostly mechanical |
| Permission catalogue | §10 roles + §9 rules | Mechanical |
| API surface | §8 modules + §11 journeys | Mostly mechanical |
| Notification events | §13 | Mechanical |
| Folder structure | §8 module list | Mechanical, given a chosen convention |
| Component inventory | §11 journeys + design system | Mostly mechanical |

## What a human must decide

| Decision | Why it is not derivable | This project's answer |
|---|---|---|
| **Topology** — monolith, modular monolith, services | Depends on team size, ops budget, hiring | Modular monolith, one deployable, "hard internal boundaries," documented extraction path |
| **Multi-tenancy model** | Cost/isolation/compliance trade-off | Shared DB, shared schema, `tenant_id` on every business table, "best cost/ops profile at this scale" |
| **Database engine** | Ops maturity, hosting, feature needs | PostgreSQL 16 |
| **Auth topology** | Threat model and client mix | BFF with HttpOnly cookie for web; Sanctum bearer tokens for mobile |
| **Real-time transport** | Whether you can operate a WebSocket server | Laravel Reverb, self-hosted as its own service |
| **State management** | Team familiarity | TanStack Query for server state; nothing else needed (and note: `zustand` was installed and never used) |
| **Hosting** | Budget, control, team skills | Railway PaaS as primary; Docker Compose on a VPS documented as an alternative |
| **What is queued** | Latency versus complexity | PDFs, mail, push, notifications |

## The decisions to make *before* writing large amounts of code

These are the ones that are expensive or impossible to retrofit. Each is illustrated by this repository.

1. **Tenancy enforcement point.** Chosen here: a global ORM scope plus a resolver middleware, with **explicit middleware priority** so tenant context binds before route-model binding. Retrofitting this after 60 models exist means auditing every query. Get it right, and prove it with a test, before feature one.

2. **Where validation lives.** Chosen here (implicitly, in the un-reviewed scaffold commit): inline `$request->validate()` in controllers — 82 call sites, 0 FormRequest classes, against an architecture document specifying FormRequests. It works, but it means validation cannot be reused, cannot be tested independently, and drifts between the create and update paths. **Decide explicitly, in commit 2, and enforce in review.**

3. **Where authorization lives.** Chosen here: `requirePermission()` on a base controller. Simple and consistent — but a new endpoint that forgets to call it is silently public. That is exactly how two dashboard endpoints ended up unprotected. If you choose this pattern, add a test that enumerates routes and asserts each one is protected.

4. **The response envelope and error codes.** Fixed here on day one (`{data, meta}` / `{error:{code,message,fields}}`, with domain codes like `MODULE_DISABLED`, `SUBSCRIPTION_EXPIRED`, `AI_NOT_CONFIGURED`) and honoured throughout. This is why the frontend can map API field errors onto form inputs generically. Cheap to fix early, expensive later.

5. **Pagination convention.** Decided in the API doc (cursor, `per_page` max 100) and then implemented on **3 endpoints out of ~60**. Pagination is nearly free to add at the start and becomes a breaking change afterwards. Decide, then enforce.

6. **How feature flags and module gating work.** Chosen here: a `modules` catalogue plus `tenant_modules` toggles, a `module:{key}` route middleware, and a bootstrap endpoint that tells the client what to render. This is what makes "pay per module" pricing possible at all, and it had to exist before modules were built.

7. **Audit strategy.** Chosen here: 71 explicit `AuditLog::` call sites rather than the model trait the architecture doc describes. Works, but forgetting is silent. A trait or model-event listener is a one-day investment that never forgets.

8. **Build-time versus runtime configuration.** Which values are baked into the frontend bundle. Getting this wrong produced a real production bug and two runbook warnings.

9. **Encryption boundary.** Which columns are encrypted at rest (here: NIN, BVN, bank details, pension PIN, medical notes, 2FA secrets). This determines what you can search on, forever. Encrypted columns cannot be queried with `LIKE`.

10. **What "deleting" means for each entity.** Here: employees are *terminated* (retained, access revoked, tokens dropped, exit event recorded) versus *deleted* (typed-code confirmation, "for one added in error"). Departments, positions and leave types refuse deletion when in use. These rules belong in the schema and the service layer from the start.

## Deliverables of this phase

`docs/03-architecture.md` (topology, module boundaries, tenancy, async, real-time), `docs/04-database-schema.md` (ERD + indexing strategy + integrity rules), `docs/05-api.md` (conventions before endpoints), the folder structure, and one ADR per decision above.

**Then do the thing this project skipped:** after the foundation commits, re-read the architecture document against the code and reconcile. Twenty minutes at that moment would have prevented the largest single piece of drift in this repository.

---

# 10. How to Build Without Losing Control (Part 8)

**RECOMMENDATION.** The failure mode of AI-assisted development is not bad code. It is *unreviewed volume* and *silent drift*. Both are process problems.

## The core mechanic: the slice contract

Before any code, the AI states: files it will touch · the schema change · permissions · endpoints · screens · tests. You approve or cut. Then it builds only that. Then you use it. Then you review the diff. Then it merges as one PR.

This project ran 22 pull requests through roughly that loop. The commits that skipped the "use it" step are the commits that came back as bugs.

## AI DEVELOPMENT RULES

Twenty-four rules. Every one is either demonstrated or violated somewhere in this repository, and the evidence is named.

**Scope and sequencing**

1. **One feature per session, one slice per pull request.** Twenty-two PRs, each individually reviewable. The one commit that broke this rule — 184 files, 25,616 insertions — is the source of the project's largest architectural drift.
2. **Plan before code, and approve only the next slice.** Approving eight slices in advance is delegating the product.
3. **Vertical, never horizontal.** Never "all the models." Always migration→UI for one capability. Every feature commit here obeys this.
4. **Refuse unrequested work.** If the AI finds an unrelated bug, it reports it; it does not fix it in your diff. Mixed diffs cannot be reviewed or reverted.
5. **Every field the API accepts must be settable from a screen — or documented as API-only.** Violated twice with real consequences: task descriptions and assignees, and employee salaries. The second one meant payroll could not run for four days.
6. **Every engine ships with its input path in the same slice.** A payroll engine with no salary form is not a feature.
7. **Every seeded default gets an editor.** Leave types were read-only; work schedules had no UI at all, which silently disabled late detection for every real customer.
8. **Every new page gets a navigation entry, permission-filtered, in the same commit.** The roles page existed, worked, and was reported as missing because nothing linked to it.

**Context and prompting**

9. **Give the AI the codebase, not a description of the codebase.** Point it at files. Let it read. Never paste fragments into a chat model and ask what your code does.
10. **Keep prompts scoped, not short.** A 400-word prompt with acceptance criteria, constraints and out-of-scope items beats a 20-word prompt every time. What ruins output is *breadth*, not length.
11. **Name the conventions to follow explicitly** — "match the validation and error-envelope pattern in `ProjectController`." Conventions are learned from examples you point at.
12. **State what must not change.** "Do not touch the payroll engine." Preservation is not assumed by default.
13. **Keep a repository instruction file** (`CLAUDE.md` / `AGENTS.md`). This repo has one at `apps/web/` with a sharp, useful warning: *"This is NOT the Next.js you know… Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* That is exactly the right kind of entry: it corrects a specific, expensive, recurring wrong assumption.

**Verification**

14. **A feature is not done until you have used it in a browser, on a phone viewport.** The strongest correlation in this entire history: commits with a specific verification sentence did not regress; commits without one did.
15. **Every test must be demonstrated capable of failing.** The gold standard here: *"added a token-auth regression test proven to fail without the fix."* The counter-example: a counter test that "passed vacuously" because it never created a row.
16. **Tests create real rows and assert exact values.** `assertJsonPath('data.open_tasks', 1)` with an open task, a done task and a colleague's task in the database. Not `assertOk()`.
17. **Ask "what did you verify, and how?"** on every delivery. Then read the answer sceptically.
18. **Never accept a fix you cannot explain.** If you cannot describe the mechanism, you cannot maintain it or judge whether it worked.

**Version control and checkpoints**

19. **Commit at every green state; branch per slice; never work on `main`.** All feature work here landed via PR.
20. **Write commit messages that explain the mechanism, not the diff.** This repository's commit messages are its best artifact — symptom, root cause, reasoning, what was verified, what was deliberately left out. They are the reason this analysis was possible at all.
21. **Green CI is the checkpoint; a tag is the rollback point; a verified backup is the safety net.** Verified, not configured.
22. **When docs and code disagree, one of them is a bug — audit deliberately.** Nine claimed capabilities in this repo's docs do not exist in its code. Nothing was watching, so nothing was caught.

**Dependencies, data and environment**

23. **Add dependencies one at a time, with a reason, and remove the ones you do not use.** `framer-motion` and `zustand` sit in `package.json`, imported nowhere. Every unused dependency is install time, attack surface, and a lie about how the app works.
24. **Migrations are additive and never edited after shipping.** Expand/contract for destructive changes. `migrate:fresh` never touches production — this repo says so in bold in its runbook.
25. **Anything that must exist in production ships as a migration, not a seeder.** The platform runs migrations automatically and seeders never. A permission that lives only in a seeder does not exist in production, and a whole feature was invisible because of it.
26. **Test against the production database engine.** SQLite in CI, Postgres in production, a query on a non-existent column, a 500 in production. Three lines of CI config.
27. **Environment variables are inventoried, and build-time values are marked as such.** `NEXT_PUBLIC_*` and `REVERB_APP_KEY` are baked at build; changing them requires a rebuild; runtime values are silently ignored.
28. **Secrets never enter the repository, a workflow input, or a log.** This repo's `railway-variable.yml` states the boundary explicitly: *"Not for secrets. workflow_dispatch inputs are stored in the run's metadata in plain text… API keys and passwords belong in the Railway dashboard."*

*(Twenty-eight rules, because the evidence supported more than twenty. If you need a short list, rules 1, 5, 14, 15, 19, 25 and 26 prevent the most damage.)*

## Practical guardrails per topic

**Preserving existing functionality.** Name it: "preserve the existing `mine=1` behaviour." One of this project's tests corrected the AI's own assumption about that flag — *"One of them corrected my own assumption — `mine=1` deliberately returns work you created as well as work assigned to you."* Tests are how intent survives.

**Avoiding unnecessary rewrites.** Ask for the smallest diff that satisfies the acceptance criteria. If a rewrite is genuinely warranted, it is its own slice with its own PR and no behaviour change.

**Checkpoints.** Before anything risky: suite green, work committed, production backed up, rollback path known. Four things, five minutes.

**Managing database changes.** One migration per slice. Additive. Reversible. Destructive changes split across two releases (add and backfill, then remove after the old code is gone) so a rollback does not lose data.

**Managing environment variables.** One table, all services, marked build-time or runtime, with a note on the failure mode when unset. This project's runbooks do this well and it is the single most copyable artifact in the repo.

---
# 11. Debugging Methodology (Part 9)

**RECOMMENDATION**, built from the seventeen bug-fix commits in this repository.

## The workflow

```
ERROR → CONTEXT → INVESTIGATION → ROOT CAUSE → FIX → TEST → VERIFY
```

**1. ERROR — capture it exactly.** The literal message, the stack trace, the failing request and response, the environment. Never a paraphrase. "It doesn't work" is not an error; "Postgres rejected `tasks.assignee_id` — column does not exist" is.

**2. CONTEXT — establish what changed and where.** Which environment (local, staging, production)? Does it reproduce locally? Which commit last worked? Does it affect all users or one role? This step alone resolves environmental bugs: three of this repo's deployment bugs were *only* reproducible on the platform, and knowing that immediately redirected the search away from application code.

**3. INVESTIGATION — read reality, not intentions.** Read the actual query the ORM generated, the actual response body, the actual environment variable value, the actual middleware order. Add temporary logging if needed. The discipline: **do not propose a fix during this step.**

**4. ROOT CAUSE — state the mechanism in one paragraph.** What the code does, what it should do, why the difference produces this symptom. If you cannot write that paragraph, you have not found the cause. This project's commit messages are essentially a collection of these paragraphs, which is why they are so useful:

> *"The route guard redirected anyone holding a session away from `/accept-invite` to the dashboard, so the setup page was unreachable on any browser that already had one — a shared or previously-used phone, or HR opening the link to check it. An invitation activates the account its token names, not whoever happens to be signed in."*

**5. FIX — smallest safe change, at the right level.** Two sub-rules from evidence:
- Fix the *shared* thing when the problem is shared. Dialogs could not scroll; the fix went on the Dialog component, *"rather than one caller, since every dialog in the app had the same ceiling."*
- Fix the *cause*, not the symptom. Late detection appeared broken; the cause was that no work schedule could be created and none existed, so registration now seeds a standard 09:00–17:00 Mon–Fri schedule and a dialog can edit it.

**6. TEST — a regression test that fails against the old code.** Not a test that passes. A test you have *watched fail*. Then it passes.

**7. VERIFY — in the real thing.** Reproduce the original user path in a browser and confirm it now works. Then, if the cause was environmental, write it down — this repo added a gotchas section to its deployment guide precisely because *"Two things cost real debugging time on this deployment and neither was written down."*

## How to write a good debugging prompt

Six components. Missing any one of them costs a round trip.

1. **Symptom** — what the user sees, exactly.
2. **Error** — verbatim message, stack trace, request/response.
3. **Environment** — local / staging / production; browser and device if relevant.
4. **Reproduction** — numbered steps, and whether it reproduces locally.
5. **Scope** — all users or one role; always or intermittently; since when.
6. **Constraint** — "explain the mechanism before proposing a fix; add a regression test."

**Template:**

> **Symptom:** `<what the user sees>`
> **Error:** `<verbatim>`
> **Environment:** `<local | staging | production>` · `<browser/device>`
> **Steps:** 1… 2… 3…
> **Reproduces locally:** `<yes | no | not tried>`
> **Scope:** `<who is affected, since when>`
>
> Do not propose a fix yet. First reproduce it or explain why you cannot. Then explain the mechanism: what the code does, what it should do, and why that difference produces this symptom. Then give me the smallest safe fix and what it risks. Then write a test that fails against current code — show me the failure — apply the fix, and show it passing. If the cause is environmental rather than in our code, add it to `docs/gotchas.md`.

## Worked prompts by error class

Each is followed by the real instance from this repository, so they can be taught with evidence.

### Frontend error
> **Symptom:** the employee edit dialog's save button is unreachable. **Environment:** production, desktop Chrome 1440×766 and iPhone 13. **Steps:** Employees → row menu → Edit → scroll. **Scope:** every user, always.
> Investigate layout: compute the dialog's content height versus viewport height and its `overflow` value, and tell me whether this is specific to this dialog or shared by the Dialog component. Fix at the level where the problem lives, then verify by measuring the scrollable height at both viewports.

*Real instance:* `7e51eb5` — 1,247px of content in a 766px window with no scrollbar; fixed on the Dialog component; verified as *"overflow-y auto with 481px of previously unreachable content now scrollable."*

### Backend error
> **Symptom:** `GET /api/v1/dashboard/summary` returns 500 for employee-role users in production, works locally. **Environment:** production Postgres; local SQLite. **Error:** `<paste>`.
> Find the code path taken for this role specifically, print the SQL it generates, and compare it against the actual schema. State the mechanism before fixing. Then write a test that exercises this path **with real rows in every table it counts** — the existing test passes with an empty table, which is why this reached production.

*Real instance:* `b3c486b` — the personal dashboard filtered on `tasks.assignee_id`, which does not exist; assignment is the `task_assignees` pivot. The fix used `whereHas('assignees', …)`; the new test creates an open task, a done task and a colleague's task and asserts the count is exactly 1.

### Database error
> **Symptom:** deleting `<entity>` orphans related rows / errors. Investigate the foreign-key behaviour and whether the delete should be blocked, cascaded, or turned into a soft state change. Propose the business rule, not just the constraint. Then implement the guard with a clean 422 and a test for both the allowed and blocked cases.

*Real instances:* `1097f33` — duplicate department names returned a raw database error instead of a 422, and departments with staff could be deleted, orphaning people; both fixed with guards and tests. `f9d5bff` — a leave type already booked against cannot be deleted "since that would strand their history," and the list flags it "so the button can explain itself."

### Authentication error
> **Symptom:** `<page>` is unreachable / the wrong user's data appears. **Environment:** `<env>`. **Scope:** users who already hold a session / users of role X.
> Trace the request through every guard: route middleware, session check, tenant resolution, route-model binding, permission check — in execution order. Tell me which one produces this outcome and whether the ordering is correct. Write a test using the same auth mechanism production uses.

*Real instances:* `bf9125b` — the route guard bounced session-holders away from the invitation page. `3132efd` — the middleware-priority bug where route-model binding ran before tenant context was bound, so *"bound models resolved unscoped and a cross-tenant id could leak"*; caught with a token-auth regression test proven to fail without the fix. The lesson: **test with the same authentication mechanism and middleware order production uses**, because a session-auth test would not have caught it.

### API error
> **Symptom:** the UI cannot set `<field>` although the API accepts it / the API accepts a field the UI never sends. Compare the API's accepted payload for `<endpoint>` against every payload the frontend actually sends. List every field accepted-but-unreachable and every field sent-but-ignored. That list is the bug.

*Real instances:* `c4d764e` (task description and assignees), `f9d5bff` (allowances not accepted by the API at all while base salary was unreachable from any screen). **RECOMMENDATION: run this diff deliberately, once per module, as a scheduled audit.** It is the single highest-yield check this repository's history suggests.

### Deployment error
> **Symptom:** the deploy reports success but the running code is old / one service is stale. **Environment:** `<platform>`.
> Verify, for each service: what commit is actually deployed, whether a build was triggered, and what triggered it. Do not assume a connected repository implies automatic deployment — check for the trigger object itself. Report what is actually configured versus what the dashboard implies.

*Real instance:* `65d4efe` — four of five services had a repo source but no branch trigger and were three days behind `main`; the worker was missing notification classes the API was dispatching to it. Also `f7b6ed5` — on `workflow_run`, the default checkout is the triggering run's *branch*, so the deploy ran one commit's code with another commit's script.

### Environment variable error
> **Symptom:** `<feature>` behaves as if unconfigured in production despite the variable being set. For each variable this feature reads, tell me: which service reads it, whether it is read at build time or runtime, and what the code does when it is empty. If it is build-time, tell me what must be rebuilt.

*Real instances:* `cba55e5` — `NEXT_PUBLIC_REVERB_*` passed as runtime env and "silently ignored"; fixed by passing them as build args. `5be7de9` — an empty CI secret looks identical whether it is unset, misnamed, stored as a variable, or environment-scoped; a diagnostic step now names the case *"without ever printing a value."*

### Build error
> **Symptom:** the build fails on the platform but succeeds locally. **Error:** `<paste>`.
> Compare the runtime the platform selected against what the lockfile actually requires, and list every native extension the app needs against what the platform's image installs. Tell me exactly which declaration in our manifests is causing the platform to choose wrongly.

*Real instances:* `a64cddd` — `"php": "^8.2"` while the lockfile resolved Symfony 8 packages needing ≥8.4.1, so Nixpacks chose 8.2 and `composer install` failed. `3cdadad` — `reverb:start` crashed with *"Undefined constant SIGINT"* because `ext-pcntl` was not declared. `b807140` — CI ran `--parallel` without ParaTest installed.

### Production error (general)
> **Symptom:** `<what users report>`. **Started:** `<when>`. **Affected:** `<who>`. **Logs:** `<paste>`.
> Triage first: is this data loss, a security issue, broken core workflow, or cosmetic? Tell me whether to roll back or roll forward and why. Then root-cause it. Do not change production directly; every fix goes through the normal pipeline.

*Real instance:* `ad5342a` — a plain employee saw the full administrator experience: every nav item, company headcount, department counts, company-wide attendance, and the pending leave queue. The response is a model of good triage: it separated *presentation* leakage (25 links rendered regardless of permission) from *real* leakage (two endpoints with no permission check at all), fixed the real one at the API, gave employees a personal dashboard instead of a 403, and made company keys **absent from the payload rather than zeroed** with a `meta.scope` marker.

---

# 12. Testing (Part 10)

## What this project actually has — FACT

- **41 test files, 149 test methods, 5,199 lines** of tests against 14,546 lines of application PHP (~36%).
- **PHPUnit feature tests dominate** (39 files): they hit real HTTP endpoints with real auth, real seeded roles and permissions, and a real (in-memory SQLite) database.
- **2 unit test files**, one of which is the important one: `PayeCalculationTest` with 5 tests pinned to hand-computed tax values.
- **A tenancy test helper** (`tests/Concerns/InteractsWithTenancy.php`) providing `seedCatalog()`, `createTenant()`, `createUserWithRole()` and `actingAsTenantUser()` — the single highest-leverage testing artifact in the repo, because it makes writing a correctly-scoped, correctly-permissioned test a three-line job.
- **Test count reported in every feature commit message** — 31 → 36 → 40 → 44 → 51 → 55 → 59 → 63 → 66 → 96 → 100 → 103 → 104 → 107 → 110 → 112 → 114 — which made regression pressure visible on every pull request.
- **Dedicated isolation tests:** `TenancyIsolationTest`, `EmployeeAccessScopeTest`, `ModuleToggleTest`, `PlatformConsoleTest` (which asserts a platform owner reading another workspace's employee list gets nothing).
- **Third-party APIs faked, not mocked away:** the FCM test asserts a real RSA-signed JWT on the wire against faked Google endpoints; the AI tests fake Anthropic and exercise a full tool-use round trip.

**What it does not have — FACT:** zero frontend tests. Zero end-to-end/browser tests. No coverage gate. No static analysis. Tests run on SQLite while production runs Postgres. `docs/02-srs.md` NFR-9 promises ≥80% coverage on services and policies plus E2E smoke in CI; none of that exists.

## The methodology — RECOMMENDATION

### The one rule that matters
**A test you have not seen fail is not a test.** Write it, run it against the unfixed code, watch it fail, then fix. This repo has both the exemplar (*"proven to fail without the fix"*) and the cautionary tale (a test that "passed vacuously").

### Testing pyramid for AI-assisted work
Conventional pyramids assume writing tests is expensive. With AI it is cheap, so the constraint shifts from *cost* to *trustworthiness*. Weight accordingly:

| Layer | Weight | Why |
|---|---|---|
| **Feature/API tests** (real HTTP, real DB, real auth) | **Heaviest** | Highest truth-per-line. Catch permission, tenancy, validation and contract bugs. This project's choice, and it was right. |
| **Unit tests** | Where logic is arithmetic or rule-heavy | Payroll, tax, pro-rata, balances, progress math. Pin to hand-computed values. |
| **Browser/E2E smoke** | 5–10 critical journeys | The layer this project lacks — and every "nobody can use it" bug would have been caught by one. |
| **Component tests** | Sparingly | Low yield when the shared primitives are few and reviewed. |

### How to test each thing

**Individual features.** One test per rule, not one per endpoint. For a leave request: submits successfully · rejected when balance insufficient · rejected when dates invalid · approver is notified · approval deducts the balance · a non-approver gets 403 · another tenant's request is invisible. This is roughly what `LeaveWorkflowTest` does.

**User journeys.** The PRD's user-flow diagrams *are* the E2E scripts. This project's acceptance criterion is already written: *"Tenant signup → onboarding → invite employees → employees clock in via GPS/QR → leave request approved → payroll run published → payslip visible on mobile: complete E2E without manual intervention."* That sentence is a Playwright test waiting to be written.

**Authentication.** Test the negatives, using the same mechanism production uses: wrong password, unknown email, expired invitation, reused invitation, replayed OAuth exchange code, wrong TOTP, reused recovery code, expired 2FA challenge, revoked token. `TwoFactorTest`, `OAuthTest` and `InvitationTest` cover much of this.

**Permissions.** For every endpoint, three tests: the permitted role succeeds, an unpermitted role gets 403, and another tenant's identical request gets 404. Cheap to generate, and they are the tests that would have caught the unprotected dashboard endpoints. Consider a single meta-test that enumerates routes and asserts each is protected.

**Forms.** Test the *payload the form actually sends*, not the payload the API theoretically accepts. `c4d764e` did this deliberately — *"Three API tests cover the payload the new form sends"* — and it is the direct antidote to API/UI drift.

**APIs.** Response shape, status codes, validation errors including field names, pagination, filtering, and the error envelope. Plus idempotency where it is claimed (this repo advertises `Idempotency-Key` in its API doc and does not implement it — either build it or delete the claim).

**Database operations.** Transactions actually roll back; guards actually block (negative stock, double asset assignment, delete-when-in-use); unique constraints are per-tenant so two tenants can reuse a name (tested here); soft deletes preserve history.

**Mobile responsiveness.** Cannot be asserted by an API test. This project verified it by driving a real 390px viewport and reporting measurements — *"no horizontal page overflow on dashboard, employees, leave or calendar,"* *"the password field computes to 16px."* That is the right technique; automate it with a Playwright viewport matrix asserting `document.scrollWidth <= window.innerWidth` on every route.

**Error states.** Force them: unconfigured integration, upstream 500, expired subscription, disabled module, network failure mid-upload. This project tests several by design (`AI_NOT_CONFIGURED`, `AI_UPSTREAM`, `MODULE_DISABLED`, `SUBSCRIPTION_EXPIRED` with a billing allowlist) — a genuinely mature pattern.

**Security.** Cross-tenant by id, by search, by report, by download, by websocket channel. Sensitive fields absent from responses for unauthorized roles. Webhook signature rejection (tested here, including replay idempotency and underpayment). File-upload type and size rejection. Rate limits on auth.

**Performance.** Assert query counts on list endpoints to catch N+1 regressions. Assert payload sizes. Set the budget from the SRS numbers and put it in CI, otherwise the numbers are decoration.

### How Claude Code helps

- **Generating the negative tests you would not bother writing.** This is where it pays most: the cross-tenant, wrong-role, expired-token matrix is tedious and mechanical, and it is where the real bugs are.
- **Writing the test that reproduces a bug before fixing it** — the single most valuable testing habit available.
- **Faking third-party APIs faithfully**, as done here with Google's token endpoint and Anthropic's Messages API.
- **Running the suite, reading failures, and iterating** without you in the loop for each cycle.
- **Auditing the suite for vacuous assertions**: "list every test that would still pass against an empty database." Run that once; it is uncomfortable and useful.

### What Claude Code cannot do for you

Decide what correctness means. Whether ₦187,432.19 is the right PAYE figure, whether a manager should see a direct report's salary, whether an exit should be blockable — those are human answers. AI writes the test; you supply the expected value.

---

# 13. From "It Works" to "Production Quality" (Part 11)

The gap between those two states is where this project spent 2026-08-04 and 08-10 — six commits, all of them usability rather than function. That is the honest ratio.

## What "production quality" meant here, concretely

Each of these was a real defect, found by a human using the product:

| Symptom | What it actually meant |
|---|---|
| No navigation on a phone below `lg` | The product did not exist on mobile |
| Form controls at 14px | iOS Safari zoomed and shifted the layout out from under the person typing |
| Dialogs with no scroll | 481px of content, including the save button, permanently unreachable |
| Disabled button with no explanation | *"A dead button reads as a broken page"* |
| Stat tiles one-per-row on mobile | Four numbers required scrolling |
| Employee code wrapping across two lines | Tables needed a minimum width and their own scroll container |
| Calendar cells squeezed to ~50px | The month grid needed its own scroll container |
| Theme switcher hidden on mobile | A setting that existed and was unreachable |
| A field that "swallowed" the space key | Slug generation stripped the trailing dash on the next keystroke |
| "Workspace address" | Read as a street address; renamed to "Workspace link" with the domain suffix shown inline |

The pattern: **production quality is mostly about reachability and legibility, not aesthetics.** Nine of those ten are "the thing exists but a person cannot get to it or understand it."

## Production-quality checklist

**UI/UX**
- [ ] Every screen built from design tokens — no ad-hoc colors, radii or spacing
- [ ] Sentence case throughout; copy addresses the user, not the developer
- [ ] Ambiguous labels renamed after watching one real person misread them
- [ ] Dates humanized ("Today, 9:14 AM"; "Mar 4" beyond a week); currency formatted with the correct symbol
- [ ] Destructive actions confirm; irreversible ones require typing a name or code
- [ ] Terminate versus delete distinguished where the domain distinguishes them

**Responsive**
- [ ] No horizontal page overflow at 390px on any route (assert `scrollWidth <= innerWidth`)
- [ ] Navigation exists and is complete on mobile, with the same permission filtering, from one shared config
- [ ] Form controls ≥16px below `sm`; touch targets ≥44px
- [ ] Wide content (tables, boards, calendars) scrolls in its own container, never the page
- [ ] Dialogs scroll; every control inside is reachable at 766px height
- [ ] Multi-column form rows stack on small screens
- [ ] Bottom padding clears the iOS home indicator

**Accessibility**
- [ ] Visible focus ring on every interactive element
- [ ] Full keyboard navigation; dialogs trap and restore focus
- [ ] Contrast verified in light **and** dark (ratios recorded, as this project's chart tokens do in comments)
- [ ] Icon-only buttons have accessible labels; charts have text alternatives
- [ ] `prefers-reduced-motion` respected

**States**
- [ ] Loading: skeletons, never a full-page spinner on navigation
- [ ] Empty: teaches what will appear and how to create the first one
- [ ] Error: says what happened and what to do next
- [ ] Partial: optimistic updates roll back visibly on failure
- [ ] Unconfigured: features without credentials show a setup notice, not an error

**Forms**
- [ ] Client validation mirrors server rules
- [ ] API field errors map onto the matching inputs (implemented here for registration)
- [ ] Requirements stated before submission, not revealed by rejection
- [ ] Submit disabled only while in flight; never disabled silently
- [ ] Long forms retain input on validation failure

**Notifications**
- [ ] Every state change a human waits on notifies someone
- [ ] Actors never notified of their own actions (explicit in this codebase)
- [ ] In-app centre with unread counts; email and push where configured; graceful when not
- [ ] Notifications deep-link to the relevant record

**Security**
- [ ] Every endpoint: authenticated, tenant-scoped, permission-checked
- [ ] Client-side gating present for UX and never relied on for security
- [ ] Sensitive fields absent from responses lacking clearance — absent, not blanked
- [ ] Audit logs record which fields changed, never encrypted values (done correctly here)
- [ ] Rate limits on auth endpoints; webhook signatures verified with constant-time compare
- [ ] No secrets in the repo, in workflow inputs, or in logs; debug off in production
- [ ] Sessions and tokens revoked when access is revoked (done here on termination)

**Performance**
- [ ] Numeric budget set and measured (P95 latency, LCP)
- [ ] Query counts checked on list endpoints; N+1s eliminated
- [ ] Every growable list paginated (this project's largest outstanding gap: 3 of ~60)
- [ ] Expensive aggregates cached with a TTL (done here: dashboard charts, 5 minutes per tenant)
- [ ] Heavy work queued: PDFs, mail, push, exports
- [ ] Indexes lead with `tenant_id` on tenant-scoped paths

**SEO / public surface** (only where public pages exist)
- [ ] Titles, descriptions, Open Graph on marketing and public pages
- [ ] Authenticated app excluded from indexing
- [ ] `robots.txt` and sitemap correct

**Branding & consistency**
- [ ] One primitive per interaction pattern; no two dialog implementations
- [ ] Shared configuration shared in code, not copied (nav list, form field sets — both unified here after drifting)
- [ ] Tenant branding applied at runtime where white-label is offered
- [ ] Favicon, page titles, email sender identity, PDF templates all branded

**Operational readiness**
- [ ] Health endpoint monitored externally
- [ ] Backups running **and a restore tested**
- [ ] Rollback procedure documented and rehearsed
- [ ] Error tracking wired to a human (this repo's outstanding gap: no Sentry despite NFR-7)
- [ ] Deployment gotchas written down

---

# 14. Security

Consolidated from `docs/07-security.md` (intent) and the code (reality), because the difference is instructive.

## Implemented — FACT

Argon2-family password hashing via the framework · Sanctum tokens · HttpOnly-cookie BFF so the browser never holds an API token · TOTP 2FA with hashed single-use recovery codes and a 5-minute cached challenge · OAuth restricted to sign-in with a 2-minute one-time exchange code so tokens never appear in URLs · invitations with sha256-hashed single-use 7-day tokens, one live per user, rotated on resend · 34-permission RBAC with `super_admin` short-circuit, custom tenant roles, and a self-lockout guard preventing a super admin from stripping their own role · tenant scoping as a global ORM scope with auto-fill, plus **explicit middleware priority** so binding cannot outrun scoping · cross-tenant lookups 404 rather than 403 · encrypted-at-rest columns for NIN, BVN, bank details, pension PIN, medical notes and 2FA secrets · audit logging of which fields changed, never encrypted values · websocket channel authorization proxied server-side with tenant and participant checks · Paystack webhooks verified with HMAC-SHA512 and constant-time comparison, activation idempotent against replay · rate limits on auth (10/min), OAuth (20/min), AI chat (30/min) and generation (15/min) · upload size and MIME caps · `X-Forwarded-*` trust for correct HTTPS URL generation behind an edge · `.env*` git-ignored with an `!.env.example` exception · secrets excluded from workflow inputs by explicit policy · a platform console authorized by account rather than permission, with a test asserting it cannot read tenant HR data.

## Claimed but absent — FACT

PostgreSQL Row-Level Security ("a second, database-enforced wall") · Sentry error tracking · PHPStan level 8 · gitleaks secret scanning · Trivy image scanning · Dependabot · `composer audit` / `npm audit` in CI · nonce-based CSP and the other security headers via nginx (the nginx config exists; these directives are **UNVERIFIED** in this analysis) · Telescope disabled in production (Telescope is not installed at all) · password history, breach checks, expiry and per-tenant complexity policy · IP allowlists · session/device management endpoints · ClamAV upload scanning · annual penetration test · immutable append-only audit grants.

## The lesson

The implemented list is genuinely strong — stronger than most products at this stage, and the tenant-binding fix in particular shows real security thinking. The absent list is not a scandal; **it is a documentation failure.** A security document that promises controls you do not have is worse than no document, because it stops you from noticing.

**RECOMMENDATION:** split `07-security.md` into "Controls in place (with the file or test that proves each)" and "Controls planned (with a date)." Then add one CI job that fails if the first list references something absent. That job is the only reason such a document stays true.

---
# 15. Deployment (Part 12)

The most detailed section, because it is where this project spent the most unplanned effort and generated the most transferable knowledge.

## The three environments

| | **LOCAL** | **STAGING** | **PRODUCTION** |
|---|---|---|---|
| Purpose | Build and debug fast | Prove the deploy and the release before users see it | Serve real users |
| Data | Seeded fake data, disposable | Anonymized or fake, refreshable | Real, irreplaceable |
| Database | Whatever is convenient — **but the same engine as production** | Same engine, separate instance | Managed, backed up, PITR |
| Secrets | Dummy or test-mode keys | Test-mode keys | Live keys, in a secret manager |
| Integrations | Log driver / disabled | Test mode (Paystack test cards, Firebase dev project) | Live mode |
| Debug | On | On | **Off, hard-off** |
| Migrations | Freely; `migrate:fresh` fine | Run as production will run them | Additive only; never `migrate:fresh` |
| Who deploys | You, constantly | CI on merge | CI on merge or tag, after green CI |
| Rollback | Irrelevant | Practice here | Rehearsed and fast |

**FACT:** this project documents Local / Staging / Production with branch mapping (`develop` → `*.staging.go3net.app`, `main` tagged → `*.go3net.app`) in `docs/08-deployment.md`, but the implemented pipeline deploys `main` straight to production with no staging environment in `services.json`. **RECOMMENDATION:** this is the highest-value missing piece of infrastructure in the repository. Every one of the deployment bugs described below would have been caught in staging at zero user cost. On Railway a second environment is a few minutes of work.

## The twenty-step deployment journey

### 1. Git repository
Branch protection on `main`, PRs required, CI required green to merge. One slice per PR. **FACT:** 22 PRs merged; feature branches named `claude/<name>`. Confirm `.gitignore` covers `.env*` with `!.env.example`, build outputs, `vendor/`, `node_modules/`, storage caches and local database files — all present here.

### 2. Production environment
Choose the smallest thing that runs your topology. This project's two documented options:
- **PaaS (Railway) — the live path.** Five services from one repo (`api`, `worker`, `scheduler`, `reverb`, `web`) plus managed Postgres and Redis. Uploads must go to object storage because services do not share disks. Cost noted in the docs: ~$15–35/month.
- **VPS + Docker Compose.** Ubuntu 22.04+, 2 vCPU / 4 GB minimum (4/8 comfortable), Docker, UFW allowing only 22/80/443, a `deploy` user, and the full compose stack behind nginx with Cloudflare in front.

Decision rule: PaaS until per-service cost exceeds a VPS *and* you have someone who wants to run servers.

### 3. Environment variables
One table, every service, every variable, marked **build-time or runtime**, with the behaviour when empty. §3.15 above is that table for this project. Three hard-won rules:
- `NEXT_PUBLIC_*` and equivalents are **inlined at build time**; changing them requires a rebuild and runtime values are silently ignored.
- Blank integration keys must make the feature dormant, not broken.
- Secrets live in the platform's secret store, never in a repo, a workflow input, or a log.

### 4. Database
Managed instance with automated backups from day one. Connection via a single `DB_URL`/`DATABASE_URL` reference where the platform offers it. Confirm which engine and version — and **use that same engine in CI.**

### 5. Database migrations
Additive, reversible, never edited after shipping. Expand/contract for destructive changes so the previous release still runs against the new schema (this repo's stated rollback strategy). Migrations run **before** the new code serves traffic — here, `api` deploys first because it carries the migrations, and if it fails "the rest are skipped rather than booted against a schema that does not match their code."

**The single most transferable deployment lesson in this repository:** *the platform runs migrations automatically and never runs seeders.* Therefore anything that must exist as data in production — permission rows, module catalogue entries, default plans — must ship **as a migration**. This project learned it the hard way (a feature's permission never reached production), then fixed it by wrapping an idempotent seeder in a migration, and documented it in two places.

### 6. Build process
Reproducible from a clean checkout. Multi-stage images (this repo: one PHP base image with `worker` and `scheduler` targets, OPcache JIT configured, non-root user). Pin your runtime to what the lockfile actually requires — `^8.2` with a lockfile needing 8.4.1 broke the first build here. Declare native extensions your dependencies need — `ext-pcntl` for Reverb's signal handling.

### 7. Hosting
Public domains only on the services that need them (`api`, `reverb`, `web`); the worker and scheduler stay private. Scope build triggers by path (`apps/api/**`, `apps/web/**`) so a frontend change does not rebuild four PHP services. **Verify the deploy trigger exists** — a connected repository is not the same object as a branch trigger, and four services here silently drifted three days behind `main` because of that distinction.

### 8. Server configuration (VPS path)
nginx reverse proxy with: PHP-FPM upstream with `SCRIPT_FILENAME` pointing at the **FPM container's** path (a real bug here — `$realpath_root` resolved inside the nginx container, which has no application files), a WebSocket location with upgrade headers and connection mapping, `client_max_body_size` matching your upload cap (25 MB here), and an internal listener for the BFF to reach the API without going out to the internet.

### 9. SSL
Terminate at the edge (Cloudflare Full/Strict with an origin certificate, or the PaaS's automatic certificates). Trust `X-Forwarded-*` in the application or every generated URL — OAuth redirects, password-reset links, payment callbacks — will be `http://` and break. This repository does exactly that in `bootstrap/app.php` with the reason in a comment.

### 10. Domain
See §16.

### 11. DNS
See §16.

### 12. API configuration
`APP_URL` (API's own public URL), `FRONTEND_URL` (used in emails and OAuth bounces), and `API_URL` on the web service pointing at the API — internally where possible. In compose, that is nginx's internal listener; on Railway, the private network. CORS is unnecessary in a BFF architecture, which is a real security and configuration benefit.

### 13. Authentication callbacks
Register the exact production callback URLs with each provider before launch: `https://<api-domain>/api/v1/auth/oauth/{google|microsoft|github}/callback`. Any mismatch — scheme, trailing slash, subdomain — fails. Decide whether OAuth may create accounts (here: no, sign-in only).

### 14. Email configuration
SMTP credentials, a verified sender domain with SPF/DKIM/DMARC, and a fallback plan. This project shipped before SMTP existed and handled it well: invitation emails went to the log, and the invite endpoint *also returned the single-use setup URL* so an admin could send it over WhatsApp. Ship the fallback, then wire the provider.

### 15. Storage
Object storage from the start if you might scale horizontally — services on a PaaS do not share disks, so local uploads silently vanish. `FILESYSTEM_DISK=s3` with R2/S3 credentials, tenant-prefixed keys (`tenants/{id}/…`), short-lived presigned URLs. On the compose path, a shared volume across `api`, `worker` and `scheduler` — a real fix here, because the worker generates payslip PDFs that the API must serve.

### 16. Cron and background jobs
A queue worker consuming the queues you actually dispatch to (`--queue=default,notifications,reports`), a scheduler process, and `queue:restart` after deploy so workers pick up new code. **The worker must be deployed from the same commit as the API** — the stale-worker bug here meant the running API dispatched notification classes the worker did not have.

### 17. Monitoring
External uptime probe on the health endpoint (`/up` here) plus a synthetic login. Alerts that reach a human: error rate, P95 latency, queue depth, database connections, disk, failed backup, certificate expiry. **FACT:** this project has the health endpoint and documents the alert thresholds, but no error tracking is wired (no Sentry despite NFR-7). That is the gap to close first.

### 18. Logging
Structured JSON to stdout so the platform collects it. Request-id correlation from edge to log. Know where queued-job failures surface — on this stack, *"the worker's log is where queued mail/PDF/push failures appear,"* which is documented precisely because it was not obvious.

### 19. Backups
Two things matter: the database and the uploads volume. Nightly dump plus continuous WAL if available; uploads replicated or tarred. Ship offsite. **Test a restore before launch.** This repo documents the commands for both, and a restore test — and its operations doc goes further with quarterly restore drills, RPO ≤ 15 min and RTO ≤ 1 h. Whether those drills happen is **UNKNOWN**; the commands existing is what makes them possible.

### 20. Rollback strategy
Three layers:
1. **Redeploy the previous image or commit.** Fast; works because migrations are additive and old code runs against the new schema.
2. **Point-in-time recovery** for data corruption, restored side-by-side and reconciled — never in place.
3. **Feature flags / module toggles** to disable a broken capability without a deploy. This project's per-tenant module toggles give it this by accident, which is a nice property of the module architecture.

Decide the rollback *trigger* before launch, in writing, so the decision is not made under stress.

## The deploy pipeline this project converged on — FACT, and worth copying

```
push to main
   ↓
CI workflow: API tests + web lint/build   ── red? stop here
   ↓ (workflow_run: completed && conclusion == success)
Railway Deploy workflow
   ├─ checkout the *triggering commit's* SHA (not the branch head)
   ├─ verify RAILWAY_TOKEN exists, and if empty, diagnose which mistake it is
   └─ deploy.sh: api first (migrations) → then worker, scheduler, reverb, web
        polling each service until green; abort the rest if api fails
   with concurrency group "railway-deploy" so deploys never overlap
```

Four design decisions in there are worth naming because each came from a specific failure:
- **Deploy on green CI only**, via `workflow_run`, rather than on push — *"Railway's own webhook would deploy on push regardless of whether the build was green."*
- **Check out the triggering commit**, because on `workflow_run` the default checkout is the branch, which would run one commit's code with another commit's deploy script.
- **Serialize deploys** with a concurrency group, because "overlapping runs would race on migrations."
- **Fail loudly and diagnostically.** The credentials step exists because an unset secret, a misnamed one, one stored as a variable, and an environment-scoped one all look identical — blank. It reports which, "without ever printing a value." That is a small masterpiece of operational empathy and the kind of thing worth teaching.

---

# 16. Domain and Live Website (Part 13)

Beginner-friendly, in the order you actually do it.

## 1. Buy the domain
Any registrar (Namecheap, Cloudflare Registrar, Google Domains successors, local registrars). Cloudflare Registrar sells at cost and puts DNS in the same place you will manage it. Buy the plain name; skip the upsells. Enable auto-renew and WHOIS privacy.

## 2. Understand what DNS actually does
DNS turns a name into an address. When someone types `go3net.app`, their computer asks DNS "where is this?" and gets back an IP address or another name to follow. Nothing else. Every domain problem is one of: the record does not exist, the record points at the wrong place, or the change has not propagated yet.

## 3. Point the nameservers
The **nameservers** decide *who answers* DNS questions for your domain. At your registrar, set them to your DNS provider (e.g. Cloudflare's two assigned nameservers). This can take a few hours to take effect worldwide. Until it does, your records do nothing — this is the single most common "why isn't my site working" cause.

## 4. Create the records
Two record types cover almost everything:

- **A record** — name → IP address. Use when you have a server with a fixed IP.
  ```
  A    go3net.app        203.0.113.10
  A    api.go3net.app    203.0.113.10
  A    *.go3net.app      203.0.113.10      ← wildcard: every tenant subdomain
  ```
- **CNAME record** — name → another name. Use when your host gives you a hostname rather than an IP (typical on PaaS like Railway, Vercel, Render).
  ```
  CNAME  www    <something>.up.railway.app
  CNAME  api    <api-service>.up.railway.app
  ```

A **wildcard** (`*.go3net.app`) is what makes per-customer subdomains work: `acme.go3net.app` and `bravo.go3net.app` both resolve without you adding a record per customer. This product's tenancy design depends on it, and its resolver reads the subdomain to identify the tenant.

**Root domain caveat:** you cannot normally put a CNAME on the bare root (`go3net.app`). If your host only gives you a hostname, use your DNS provider's flattening feature (Cloudflare calls it CNAME flattening) or an ALIAS/ANAME record.

## 5. www versus root — pick one and redirect the other
Decide which is canonical (`https://go3net.app` or `https://www.go3net.app`), and make the other permanently redirect to it. Both answering independently splits your SEO, breaks cookies set on one host, and confuses OAuth callbacks. Pick the root for an app, then redirect `www`.

## 6. SSL and HTTPS
HTTPS encrypts traffic and is mandatory — browsers mark plain HTTP as insecure, and secure cookies (which this app's session depends on) will not be sent over it.

- **On a PaaS:** attach the domain and the certificate is issued automatically. Nothing to do.
- **Behind Cloudflare:** turn the proxy on (orange cloud), set SSL/TLS mode to **Full (strict)** and install a Cloudflare origin certificate on your server. "Flexible" mode is insecure between Cloudflare and your server — do not use it.
- **On a bare VPS:** Let's Encrypt via certbot, with a DNS challenge if you need a wildcard certificate.

Then enable HSTS, and confirm **your application trusts the forwarding headers** — otherwise it generates `http://` links even though users arrive over HTTPS, and every email link and OAuth redirect breaks. This project handles it with `trustProxies(at: '*')` and says why in a comment.

## 7. WebSockets
If you have real-time features, confirm your edge allows WebSocket upgrades (Cloudflare: Network → WebSockets, on by default) and that the upgrade request returns **101**, not 200 or 400. This project's troubleshooting table gives the exact check: devtools → Network → WS → the `wss://<host>/app/<key>` request must be 101.

## 8. Update every place the domain is written down
This is the step people forget, and it is where the failures are silent. For this application:

| Setting | Where | Value |
|---|---|---|
| `APP_URL` | api service | `https://api.go3net.app` |
| `FRONTEND_URL` | api service | `https://go3net.app` |
| `API_URL` | web service | API's URL (private network internally if possible) |
| `NEXT_PUBLIC_REVERB_HOST` | web service, **build-time** | WebSocket host, no scheme |
| OAuth redirect URIs | Google / Microsoft / GitHub consoles | `https://api.go3net.app/api/v1/auth/oauth/<provider>/callback` |
| Payment webhook | Paystack dashboard | `https://api.go3net.app/api/v1/billing/webhook/paystack` |
| Mail sender | SMTP provider + `MAIL_FROM_ADDRESS` | `office@go3net.app`, domain verified with SPF/DKIM/DMARC |

Remember: the `NEXT_PUBLIC_*` values are compiled into the frontend bundle. **Changing them requires a rebuild**, not a restart.

## 9. Verify, in this order
1. `dig go3net.app` and `dig api.go3net.app` return what you expect
2. `curl -I https://go3net.app` → 200, and `http://` redirects to `https://`
3. `curl https://api.go3net.app/up` → 200
4. A WebSocket connection returns 101
5. Sign up, sign in, upload a file, trigger an email, complete a test payment
6. Sign in with each OAuth provider you enabled
7. Do all of it once from a phone on mobile data, not office wifi

## 10. When it does not work
| Symptom | Almost always |
|---|---|
| Nothing resolves | Nameservers not switched, or not propagated yet |
| Resolves to the wrong place | An old A/CNAME record still present; delete it |
| Certificate warning | Domain attached to the host but certificate not issued yet; or Cloudflare on "Flexible" |
| Site loads, links are `http://` | App not trusting forwarding headers |
| Tenant subdomains 404 | Wildcard record missing, or the wildcard domain not attached at the host |
| Login works, then everything says "unreachable" | Web service cannot reach the API — wrong `API_URL` |
| OAuth "redirect_uri_mismatch" | The registered URI differs from the actual one, exactly |
| Real-time needs a refresh | WebSocket not connecting; check for 101, and rebuild the frontend if you changed the key |

---

# 17. Production Management (Part 14)

The methodology does not end at launch. In this project, launch was day 2 of 12.

## The operating loop

```
Monitor → Triage → Reproduce → Root-cause → Fix + regression test → Deploy → Verify → Write down what was learned
```

## Practices

**Updates.** Same slice discipline as before launch: one change, one PR, tests, review. Post-launch is exactly when "just add it quickly" destroys a codebase.

**Bug fixes.** Every production bug gets a test that would have caught it. No exceptions — this is the mechanism that stops a codebase from decaying. This project did it consistently: the dashboard 500 fix rewrote the test to create real rows; the tenant-binding fix added a regression test proven to fail without it.

**New features.** Still slices. Still a plan first. Still used in a browser before merge.

**Database migrations.** Additive, backed up first, run before the new code serves traffic. Expand/contract for anything destructive. Never `migrate:fresh`.

**Backups.** Automated, offsite, and **restore-tested on a schedule.** A backup you have never restored is a hope.

**Monitoring.** Uptime probe, error tracking, queue depth, database health, certificate expiry. Alerts must reach a human, and there must be few enough of them that the human still reads them.

**Security updates.** Dependency updates one at a time, tested. A scheduled advisory check. Rotate credentials on staff changes. Revoke sessions when access is revoked — this app does that on termination, which is exactly right.

**Performance.** Watch the budget from the SRS, not vibes. Fix the top offender, measure, repeat.

**User feedback.** The richest bug source there is. Nine of this project's post-launch commits came from someone using the product and finding it wanting. Route feedback into the same triage as errors.

**Analytics.** Activation funnel, module adoption, retention. Enough to know whether the thing you shipped is used.

**Version control.** Tag releases. Keep the roadmap honest — this project's roadmap is unusually candid, marking each module ✅ with a "what is next" note rather than implying completeness.

**Rollbacks.** Rehearsed, with the trigger decided in advance.

**Disaster recovery.** Written scenarios: node loss, region loss, corruption, compromise. Each with a target time and a rehearsed procedure. This project documents four scenarios with RPO/RTO targets; whether the drills happen is **UNKNOWN**, but the document is what makes them possible.

## POST-LAUNCH MANAGEMENT CHECKLIST

**Daily**
- [ ] Error tracker: new issues triaged
- [ ] Uptime and queue depth green
- [ ] Failed background jobs reviewed (payslips, mail, push all fail here silently in the worker log)
- [ ] New user signups completed onboarding successfully

**Weekly**
- [ ] Merge one slice minimum; suite green and larger
- [ ] Every production bug from the week has a regression test
- [ ] Dependency advisories reviewed
- [ ] Backup jobs all succeeded
- [ ] P95 latency and LCP against budget
- [ ] User feedback triaged into: incident / bug / usability gap / feature

**Monthly**
- [ ] **Restore a backup into staging and run the smoke checklist**
- [ ] Rehearse a rollback
- [ ] Review the permission matrix against the roles document
- [ ] Documentation-drift audit: does every doc claim still hold?
- [ ] Update dependencies one at a time
- [ ] Review costs against usage
- [ ] Rotate any credential shared with a departing collaborator

**Quarterly**
- [ ] Full disaster-recovery drill against the written scenarios
- [ ] Security review: new endpoints authenticated, scoped, permission-checked
- [ ] Load test the known thundering herds (for this product: 8–9 AM clock-in spike, payroll day)
- [ ] Roadmap reconciled with reality; deferred items either scheduled or dropped
- [ ] Re-read the PRD. Is this still the product?

**Per release**
- [ ] CI green
- [ ] Migration plan and rollback reviewed
- [ ] Backup taken immediately before
- [ ] Deployed from the tested commit, all services, same commit
- [ ] Workers restarted to pick up new code
- [ ] Smoke checklist run by a human
- [ ] Release tagged
- [ ] Gotchas document updated if anything surprised you

---
# 18. The Master AI Development Prompt (Part 15)

**RECOMMENDATION.** Give this once at the start of a project, and keep it in the repository as `CLAUDE.md` (or `AGENTS.md`) so it applies to every session automatically. This project has a small version of that file already — one sharp, expensive-lesson warning about the framework version — which is the right instinct.

Every rule below traces to something that went right or wrong in this repository.

---

```markdown
# Engineering partnership rules

## Role
You are a senior full-stack engineer and my engineering partner on this project.
You are not a code generator. You are expected to disagree with me, to say when a
request is a bad idea, to ask before assuming, and to tell me when something I
believe about this codebase is wrong. Being agreeable at the cost of being correct
is the worst thing you can do here.

## Project context
- Product: <one line>
- Users and their devices: <who, on what>
- Stack: <language/framework versions, database, hosting>
- Specification: docs/01-prd.md (contract) and docs/02-srs.md (requirements)
- Architecture: docs/03-architecture.md — if the code and this document disagree,
  tell me; do not silently follow either one.
- Read before writing: for any framework whose major version is recent, read the
  installed docs rather than relying on your training data. Conventions change.

## Working method
1. One vertical slice at a time: migration → model → service → API → UI → tests,
   for exactly one capability.
2. Before writing code, state: files you will touch, schema changes, permissions,
   endpoints, screens, tests. Then WAIT for my approval.
3. Never do unrequested work. If you find an unrelated bug, tell me; do not fix it
   in this diff.
4. If the request is ambiguous, ask. Do not choose silently and document the choice
   afterwards.
5. If you cannot do part of it, say so explicitly rather than producing something
   adjacent.

## Coding standards
- Match the surrounding code: naming, layering, error handling, comment density.
- Follow the existing patterns exactly — point at the file you are matching.
- Comments explain WHY, not what. A comment that restates the code is noise; a
  comment that records a non-obvious reason is gold.
- No dead code, no commented-out code, no TODOs left in a merged diff.
- No new dependency without telling me what it is for and what it replaces.

## Architecture rules
- Respect module boundaries. Cross-module access goes through the defined seam.
- Business logic lives in services, not controllers, when it is more than validation
  plus a query.
- Shared behaviour is fixed in the shared component, not at each call site.
- Configuration that varies per customer belongs in data, not in code.

## Security rules
- Every endpoint: authenticated, scoped to the caller's organization, and
  permission-checked. State which of the three each new endpoint has.
- Deny by default. New capabilities are invisible until explicitly granted.
- Client-side permission checks are for UX only. Never rely on them.
- Sensitive fields are absent from responses lacking clearance — absent, not blanked.
- Never log, print, or commit a secret. Never put a secret in a CI workflow input.
- Cross-organization lookups return 404, not 403.
- Audit records which fields changed, never the values of encrypted fields.

## Git rules
- Branch per slice; never commit to the default branch.
- One logical change per commit. Refactors are their own commits with no behaviour
  change.
- Commit messages explain the mechanism: what was wrong, why, what you changed, what
  you verified, and what you deliberately left out. Not a summary of the diff.
- Never rewrite shared history. Never force-push a shared branch.

## Testing rules
- Every change ships with tests in the same commit.
- Tests create real rows and assert exact values. A test that would pass against an
  empty database is not a test.
- For a bug fix: write the failing test FIRST, show me it failing, then fix it.
- Test with the same authentication mechanism and middleware order production uses.
- For every new endpoint, add: permitted role succeeds, unpermitted role is refused,
  another organization's request is not found.
- Run the suite before telling me you are done, and report the count.

## Feature development rules
- Every field the API accepts must be settable from a screen, or explicitly
  documented as API-only.
- Every default you seed must have an editor in the product.
- Every new page must appear in navigation, permission-filtered, in the same commit.
- Every screen needs loading, empty and error states.
- Every feature must work at 390px wide: form controls ≥16px, touch targets ≥44px,
  wide content scrolling in its own container, dialogs scrollable.
- An unconfigured integration must be dormant with a clear setup notice, never broken.

## Debugging rules
- Reproduce before diagnosing. Diagnose before fixing.
- Explain the mechanism in one paragraph before proposing a fix: what the code does,
  what it should do, why the difference causes this symptom.
- Smallest safe fix. Fix causes, not symptoms.
- If the cause is environmental rather than in our code, add it to docs/gotchas.md.

## Database rules
- Migrations are additive and reversible. Never edit a shipped migration.
- Destructive changes are split across two releases (add + backfill, then remove).
- Anything that must exist as data in production ships as a MIGRATION, not a seeder —
  deployment runs migrations automatically and never runs seeders.
- Never run destructive commands against production. Never `migrate:fresh` outside
  local.
- Tell me before any schema change, and confirm a backup exists.

## Deployment rules
- CI must be green before anything deploys.
- Deploy the same commit to every service. A stale worker running old code against
  new API dispatches is a real failure mode.
- Maintain an environment-variable inventory marking which values are build-time only.
- Verify the deploy trigger actually exists; a connected repository does not imply
  automatic deployment.
- Pin runtimes to what the lockfile requires; declare native extensions explicitly.
- Never deploy a schema change without a rollback path.

## Communication rules
- Lead with what you did and what you verified, then the details.
- Always answer "what did you verify, and how?" with specifics: what you clicked,
  what you measured, what the numbers were.
- Report what you did NOT do and why.
- Flag risks and trade-offs unprompted.
- If you are uncertain, say so and say what would resolve it. Never present a guess
  in the register of a fact.
- Keep it short. I will ask for more.
```

---

# 19. Prompt Library (Part 16)

**RECOMMENDATION.** Each entry: when to use it, what to provide, what to expect. Prompts are written for Claude Code unless marked **[ChatGPT]**.

## Planning

### P1 · Idea analysis **[ChatGPT]**
**When:** before there is a repository.
**Provide:** one sentence of ambition; who you think it is for.
**Expect:** personas as jobs, competitor weaknesses, a wedge, a v1 cut, the strongest argument against building it.
> Act as a skeptical product strategist. My idea: `<one sentence>`. Give me (1) four buyer personas as jobs-to-be-done, (2) a competitor table with each one's specific weakness, (3) the wedge that would make someone switch, (4) five things I should refuse to build in v1, (5) the strongest argument that this should not be built.

### P2 · PRD generation
**When:** after the brief exists and is agreed.
**Provide:** the brief; domain rules you know; jurisdiction; budget reality.
**Expect:** PRD + SRS with numbered requirements, an MVP column, non-goals, and a separate labelled aspirations section.
> Using `<brief>`, draft a PRD and SRS following the template in `docs/templates/prd.md`. Numbered requirements with M/S/C priority. A strict MVP column labelled as the contract. Measurable non-functional targets. Mark anything you inferred rather than took from the brief, and put anything we cannot currently enforce in a clearly-labelled "Aspirations (not yet requirements)" section.

### P3 · Feature planning
**When:** at the start of every slice.
**Provide:** the capability, the requirement IDs, constraints, what must not change.
**Expect:** a file list, schema change, permissions, endpoints, screens, tests — and a pause.
> Plan the slice for `<capability>` (`<FR-IDs>`). List: files created or changed, schema change, permissions involved, endpoints, screens, tests you will add, and anything you consider out of scope. Flag every ambiguity instead of choosing. Do not write code yet.

### P4 · User stories
**When:** when a feature involves several roles.
**Provide:** roles and the workflow.
**Expect:** stories with acceptance criteria and the negative cases.
> For `<feature>`, write user stories per role (`<roles>`) with acceptance criteria. For each, add the negative cases: who must be refused, what state makes the action invalid, and what must be preserved if it fails halfway.

## Architecture

### A1 · Tech stack selection
**Provide:** PRD, team skills, budget, hosting preference, expected scale.
**Expect:** options with trade-offs, a recommendation, and questions where you hold the information.
> Read `docs/01-prd.md`. Recommend a stack. For each decision — topology, multi-tenancy, database, frontend, auth topology, state, real-time, jobs, storage, hosting — give 2–3 options, trade-offs and a recommendation. Ask instead of assuming where the answer depends on my budget, team or compliance. End with the three decisions most expensive to reverse.

### A2 · Database design
**Provide:** PRD data requirements and business rules.
**Expect:** ERD, indexing strategy, integrity rules, and a marked list of sensitive columns.
> From `docs/01-prd.md` §9 and §12, design the schema. Produce an ERD, the indexing strategy (lead composite indexes with the tenant key), foreign-key behaviours per relationship with reasoning, which columns must be encrypted at rest, which entities may never be hard-deleted, and which need retention rules. Then tell me which business rules the schema cannot enforce and will need service-layer guards.

### A3 · API design
**Provide:** module list, journeys, existing conventions.
**Expect:** conventions first, then endpoints.
> Design the v1 API. Start with conventions — response envelope, error codes, status codes, pagination, filtering, sorting, idempotency — then the endpoints per module. Only include conventions we will actually implement; if you list a header or behaviour, we are committing to building it.

### A4 · Folder structure
**Provide:** the architecture decisions.
**Expect:** a structure with one example file per kind, and a rule for what goes where.
> Propose the folder structure for this architecture. For each directory, state what belongs there and what does not. Then create one reference example per kind — one controller, one service, one page, one test — and stop for review before generating more. Prescribe only what we will enforce in review.

## Development

### D1 · Build a feature (the workhorse)
**When:** every slice, after P3 is approved.
**Provide:** the approved plan; the convention file to match; what must not change.
**Expect:** all layers, tests, docs, nav entry, and a verification report.
> Implement the approved plan for `<capability>`. Match the conventions in `<reference file>` exactly. Every field the API accepts must be settable from a screen; every default seeded must have an editor; the page must appear in navigation permission-filtered; include loading, empty and error states. Tests must create real rows and assert exact values. Ship permission changes as migrations. Then run the app, complete the user's whole job through the UI at 1440px and 390px, and report exactly what you verified. Do not touch anything outside this slice — preserve `<named behaviour>`.

### D2 · Build a component
**Provide:** where it will be used; the states it needs; the primitive set.
**Expect:** one component, all states, added to the gallery.
> Build `<component>` using our existing primitives and tokens — no new colors, radii or spacing values. Cover these states: `<default, loading, empty, error, disabled, …>`. Keyboard accessible with a visible focus ring, ≥44px touch targets, ≥16px text on mobile. Add it to the component gallery page showing every state. Tell me if an existing primitive already covers this.

### D3 · Build an API endpoint
**Provide:** the contract, permission, tenancy expectation.
**Expect:** endpoint + the three-test permission matrix.
> Add `<METHOD> <path>`. Follow our envelope and error codes. Validate `<rules>`. Permission: `<key>`. Must be tenant-scoped. Update `docs/05-api.md` in the same commit. Add three tests: permitted role succeeds with exact response assertions, unpermitted role refused, another tenant's identical request not found.

### D4 · Create a database migration
**Provide:** the change; whether data exists in production.
**Expect:** additive migration, rollback note, expand/contract plan if destructive.
> Write a migration for `<change>`. It must be additive and reversible. If anything is destructive, split it into an expand release and a contract release and tell me what must ship between them. If this requires data to exist in production (permissions, catalogue rows, defaults), ship it as a migration rather than a seeder and explain why in a comment. Tell me what to back up before running it.

## Debugging

### B1 · Diagnose an error
**Provide:** symptom, verbatim error, environment, steps, scope.
**Expect:** reproduction, mechanism, smallest fix, failing-then-passing test.
> `<Use the debugging template from §11.>`

### B2 · Investigate a regression
**Provide:** what worked before, what broke, roughly when.
**Expect:** the responsible change and why the test suite missed it.
> `<Behaviour>` worked at `<commit/date>` and is broken now. Find the change responsible — bisect if useful — and explain the mechanism. Then tell me why our tests did not catch it, and add the test that would have. That second part matters more than the fix.

### B3 · Fix a deployment issue
**Provide:** platform, what the deploy reported, what the app actually does.
**Expect:** actual versus assumed state of the platform.
> Deploy to `<platform>` reports `<result>` but the app does `<behaviour>`. For each service verify: what commit is actually running, whether a build was triggered and by what, which environment variables it actually has, and whether any value it needs is build-time only. Do not assume a connected repository implies automatic deployment. Report actual versus assumed, then fix.

## Quality

### Q1 · Code review
**When:** before merging anything you did not watch being written.
**Provide:** the diff or branch; the original plan.
**Expect:** findings ranked, with the plan as the reference.
> Review `<branch/diff>` against the plan we agreed. Report: anything outside the agreed scope, behaviour silently removed, missing permission or tenancy checks, tests that would pass against an empty database, N+1 queries, unhandled failure paths, secrets, leftover TODOs or dead code, and any place where a shared component should have been fixed instead of a call site. Rank by severity. Do not fix anything yet.

### Q2 · Security review
**Provide:** the routes file and recent diffs.
**Expect:** an endpoint table with gaps, and failing tests for the real ones.
> Security review. Table every endpoint: authentication required, tenant-scoped, permission checked, sensitive fields in the response. Flag every gap. Separately check: file upload validation, auth rate limits, webhook signature verification, secrets in the repo or in CI inputs, debug mode in production, what audit logs record, and whether cross-tenant lookups return 404. For each real gap, write the failing test before proposing a fix.

### Q3 · Performance review
**Provide:** the endpoints or pages that feel slow; your budget.
**Expect:** measurements first, then the smallest fixes.
> Measure before proposing anything. For the ten heaviest endpoints report query count and payload size; for the main pages report bundle size and blocking requests. List unpaginated list endpoints and missing composite indexes. Then propose the smallest fixes ranked by impact, with expected before/after numbers. Budget: `<P95, LCP>`.

### Q4 · UI review
**Provide:** the pages; the viewports.
**Expect:** measured findings, not opinions.
> Drive the app and review `<pages>` at 390px and 1440px in light and dark. Report measured problems: horizontal page overflow, unreachable controls, content clipped inside a container, text under 16px in a form on mobile, touch targets under 44px, missing loading/empty/error states, disabled controls with no explanation, inconsistent spacing against our token scale. Screenshot each problem. Fix shared components rather than call sites where the problem is shared.

### Q5 · Documentation-drift audit
**When:** monthly, and before any release you will describe publicly.
**Provide:** the docs directory.
**Expect:** an honest table.
> Audit every claim in `docs/` about tooling, testing, security, performance and architecture against what is actually in this repository. One table: claim, document, evidence in code, status (implemented / partial / absent). Do not change anything — show me first. Be pedantic; a claim that is 80% true is "partial."

## Deployment

### E1 · Production readiness
> Pre-launch review. Produce: a complete environment-variable inventory per service marking build-time-only values; the migration plan and its rollback; a smoke checklist covering signup, login, 2FA, the core workflow, upload, email, background jobs, real-time and payment in test mode; verification that every third-party callback URL matches production; confirmation that each unconfigured integration degrades cleanly; a five-minute rollback procedure. Then crawl every route and report any link pointing at a page that does not exist.

### E2 · Deployment preparation
> We are deploying to `<platform>` for the first time. Before we start, tell me what this platform does automatically and what it does not — specifically whether it runs migrations, whether it runs seeders, how it chooses the language runtime, which native extensions its image includes, and how it decides to rebuild. Then write the deployment config and the runbook, and list the five most likely first-deploy failures for this exact stack and platform.

### E3 · Domain configuration
> I have bought `<domain>` and want the app live on it. Give me the exact DNS records including any wildcard I need for subdomains, the TLS setup for `<edge/platform>`, the www-versus-root decision and redirect, every application setting that contains a URL and its new value, every third-party callback URL to update, and which of these values require a rebuild rather than a restart. Then give me the verification commands in order.

## Maintenance

### M1 · Add a feature to an existing codebase
> Add `<capability>`. First read the relevant existing module and tell me the conventions you will follow and any existing behaviour you must preserve. Then plan the slice and wait for approval. Note explicitly anything in the current code that makes this harder than it should be — but do not fix it in this slice.

### M2 · Refactor
> Refactor `<area>` to `<goal>`. Constraint: zero behaviour change. Run the suite before and after and show me both results. No feature work in this commit. If you find a bug while refactoring, report it separately rather than fixing it here. If the refactor cannot be behaviour-neutral, stop and tell me why.

### M3 · Update a dependency
> Update `<dependency>` from `<version>` to `<version>`. Read its changelog for breaking changes affecting how we use it. Update our usage, run the suite, and run the app. Report what changed in our code and what behaviour I should verify manually. One dependency per commit.

### M4 · Fix a production bug
> `<Use the debugging template from §11.>` Additionally: tell me whether to roll back or roll forward and why, and whether any user data was affected. Do not change production directly — the fix goes through the normal pipeline. After the fix, add the regression test, and if the cause was environmental add it to `docs/gotchas.md`.

---

# 20. What a Beginner Should Know (Part 17)

**RECOMMENDATION.** Written honestly, because the alternative sells a course and produces broken products.

## The honest framing

AI can write code you could not have written. It cannot want what you want, notice what you did not ask about, or be accountable for what ships. This repository is proof of both halves: a 30,000-line multi-tenant SaaS platform in twelve days — *and* a payroll engine that could not run for four days because no screen could set a salary, and an employee who could see company headcount because two endpoints had no permission check.

Neither of those was an AI failure. Both were **supervision** failures. Supervision is the skill you must acquire; it is smaller than "learn to code" and much larger than "learn to prompt."

## What you must learn (non-negotiable)

1. **Version control as a safety net.** Commit, branch, diff, revert. Not the theory of git — the four operations that mean a mistake costs minutes. Without this, AI-assisted development is genuinely dangerous, because volume is high and mistakes are silent.

2. **How to read a diff.** You will not write most of the code. You must be able to look at a change and answer: what did this touch, and is anything here unrelated to what I asked for? This one skill catches most damage.

3. **The request/response model.** A browser sends a request; a server answers; a database stores. Where your code runs, and therefore where a problem can be. Every debugging conversation depends on this.

4. **What an environment variable is, and the difference between build-time and runtime.** This is the number one cause of "it works locally but not in production," and it cost this project real bugs.

5. **Authentication versus authorization.** Who you are versus what you may do. Every access bug lives in this distinction, and AI will happily implement authentication perfectly while leaving authorization to chance.

6. **What a database migration is, and why you never edit a shipped one.** Along with: your production data is irreplaceable, and a backup you have never restored is a wish.

7. **How to read an error message.** Not fix it — read it. Which file, which line, what it literally says. Paste it verbatim, never paraphrase.

8. **What a test proves and what it does not.** Specifically: a test can pass while the feature is broken. Ask "would this test pass if the table were empty?" — this project shipped a production 500 behind a test that would have.

9. **How to use your own product as each user type.** The most valuable debugging tool you have. Every usability bug in this repository was found this way, and none by a test.

10. **When to stop and ask.** Money, personal data, deletion, security, legal. If you are not sure, you are in the category that needs a human.

## What you can defer

- Writing idiomatic code in your stack's language from memory
- Framework internals and lifecycle minutiae
- Advanced SQL and query optimization (until something is slow)
- CSS layout mechanics (if you use a token-based system and component primitives)
- Docker internals, Kubernetes, infrastructure-as-code
- Design patterns as vocabulary
- Algorithms and data structures
- Build tooling configuration

You will absorb much of this incidentally by reading diffs and asking why.

## What AI genuinely handles well

Boilerplate and wiring · CRUD across all layers · translating a specification into a schema · writing the tedious negative tests you would skip · framework-specific idioms · migrations · configuration files · deployment scripts · reading an unfamiliar codebase and mapping it · explaining an error message · finding where in a codebase something lives · writing documentation · generating the seventh similar module consistently with the first six.

## What you must understand yourself, permanently

1. **What the product is for.** AI optimizes what you point at. Pointing is your job — and this project shows what happens when nothing constrains breadth: sixteen modules, several one screen deep.
2. **Who may see what.** You must be able to state, for each role, what they must never see. AI implements the model; it cannot know your policy.
3. **Every number involving money.** Tax, invoices, salaries, balances. Verify them yourself, by hand, once.
4. **What happens when it goes wrong.** Where the data is, how to restore it, how to roll back.
5. **Whether it is actually good.** Taste and judgement. Not delegable, ever.

## Technical concepts you cannot safely ignore

| Concept | Why ignoring it hurts you |
|---|---|
| HTTPS and why secure cookies need it | Sessions silently break; users are warned your site is unsafe |
| The difference between the client and the server | You will "hide" something in the browser and think it is protected |
| Why hiding a button is not security | The exact bug in `ad5342a`: the UI hid links while two endpoints returned company data to anyone who asked |
| Environment variables and secrets | You will commit an API key, or spend a day on a variable that needed a rebuild |
| Migrations and backups | The one mistake class that is unrecoverable |
| What a queue/background job is | You will not know where a failed email went (answer: the worker's log) |
| Multi-tenancy, if you have multiple customers | The most expensive bug class in SaaS; this project had one and fixed it with a middleware ordering change |
| Caching and staleness | "It's fixed but I still see the old thing" |
| Rate limits and abuse | Your login endpoint will be attacked |
| Third-party failure modes | Your payment provider will time out; decide now what happens |

## The realistic learning path

**Weeks 1–2.** Build something small and complete with AI. Ship it. Do not aim for good; aim for *deployed*. You will learn more from one deployment than from a month of tutorials.
**Weeks 3–6.** Rebuild it properly with the slice discipline: plan, one feature, tests, review the diff, use it, merge. Read every line the AI writes even when you do not understand it — pattern familiarity comes before comprehension.
**Months 2–3.** Take on multi-user with roles. Break your own permissions deliberately. Learn what a security boundary feels like.
**Months 3–6.** Operate something with real users. Get paged. Fix a production bug. Restore a backup. This is where you become someone who can be trusted with software.

## The honest bottom line

AI removes most of the *typing* and much of the *knowledge lookup*. It does not remove the *responsibility*, the *judgement*, or the *understanding required to supervise*. Someone who cannot read a diff, cannot state their permission model, and has never restored a backup will ship something that works until it matters. The gap between "it works on my laptop" and "a company runs its payroll on it" is not closed by better prompts. In this project it was nine of twelve days of careful, unglamorous, human-driven work.

---
# 21. Lessons From This Project (Part 18)

The most valuable section for teaching, because every claim here is checkable against the repository.

## What was done well

1. **Documentation before code — the root commit.** Eleven documents, 1,174 lines, before a single line of application code. It kept a 14-module scope coherent for twelve days and it is the reason this analysis was possible.

2. **Vertical slices with a visible test count.** Twenty consecutive commits, each one module end-to-end, each reporting the running suite total. Regression pressure became visible on every pull request. Commit messages like *"Suite: 103 passing (549 assertions)"* are a cheap, powerful discipline.

3. **Commit messages that teach.** The single best artifact in the repository. Symptom, root cause, mechanism, what was verified, what was deliberately deferred. Example worth quoting in full:
   > *"Working hours — attendance decides who is late from a work schedule, but nothing in the product could create or edit one, and a freshly registered workspace got none at all. Late detection was therefore inert for every real customer: with no schedule assigned, lateness() returns false and nobody is ever flagged."*

4. **The tenant-binding security fix, and how it was proved.** Route-model binding ran before tenant context was bound, so bound models resolved unscoped. The fix was three lines of middleware priority. The important part: *"added a token-auth regression test proven to fail without the fix."* That sentence is the whole testing methodology in twelve words.

5. **Graceful degradation as a design principle.** AI without a key returns `AI_NOT_CONFIGURED` with a UI setup notice. Mail falls back to the log driver. Push adds itself to the notification channel list only when configured *and* a device is registered. Blank keys keep features dormant, not broken. This is what allowed the product to ship before every third-party account existed.

6. **The invitation link fallback.** SMTP was not configured, so invitation emails only reached the log. Rather than blocking, the invite endpoint *also returns the single-use setup URL* and the UI shows a copy-link dialog, so admins could hand it over WhatsApp. Pragmatism that does not compromise security — the employee still chooses their own password.

7. **Payroll tests pinned to hand-computed values.** Five unit tests, versioned tax tables selected by run year so historical runs stay correct. Exactly right for anything involving money.

8. **Faking third parties faithfully.** The FCM test asserts a genuinely RSA-signed JWT on the wire against faked Google endpoints. The AI tests exercise a full Anthropic tool-use round trip. Neither test is theatre.

9. **Security boundaries proved by test, not intention.** The platform console can read account and billing facts across all workspaces and *cannot* read any customer's HR data — and `PlatformConsoleTest` asserts it by having an owner request another workspace's employee list and get nothing.

10. **Authorization by account rather than permission for the highest-privilege surface.** *"so no workspace administrator can grant it to themselves."* A genuinely sophisticated decision that most products get wrong.

11. **Fixing shared components rather than call sites.** The scroll fix went on the Dialog component *"rather than one caller, since every dialog in the app had the same ceiling."* Same instinct with the navigation list, unified so *"the two cannot drift apart."*

12. **Deployment gotchas written down as they were discovered.** *"Two things cost real debugging time on this deployment and neither was written down"* — followed by a commit that writes them down. That is a learning organization in one commit.

13. **CI that refuses to deploy a red build**, deploying the *triggering commit* rather than the branch head, serialized so migrations cannot race, `api` first so nothing boots against a mismatched schema. All four of those are lessons paid for in failures.

14. **A diagnostic step for a missing secret** that reports *which* of four indistinguishable mistakes it is, without printing a value. Operational empathy, and rare.

## What was done badly

1. **The 25,616-line scaffold commit.** 184 files in one commit. Unreviewable. It set the codebase's real conventions by accident, and those conventions contradict the architecture document nobody re-read.

2. **Documentation drift, unmonitored.** Claimed and absent: Sentry, PHPStan level 8, gitleaks, Trivy, Dependabot, dependency audit in CI, Postgres RLS, pgvector, Telescope, OpenAPI generation, idempotency keys, password history and breach checks, IP allowlists, device-session management, ClamAV scanning, ≥80% coverage, E2E smoke in CI. The security document is the worst offender, and a security document that overstates its controls is actively harmful.

3. **The architecture document describes a codebase that does not exist.** Specified: per-module FormRequests, Resources, Repositories, DTOs, Policies, Events, Listeners, routes and migrations. Actual: 0 FormRequests (82 inline `validate()` calls), 0 Repositories, 0 Policies, 0 per-module route files, one flat migrations directory, 60 flat models, one 400-line routes file. The code works; the document is fiction.

4. **Tests on SQLite, production on Postgres.** Directly caused a production 500. Three lines of CI configuration would have prevented it, and the project's own deployment doc specified Postgres in CI.

5. **Zero frontend tests, zero end-to-end tests.** Every "it works but nobody can use it" bug — the payroll with no salary field, the task form with no assignee field, the unreachable roles page, the missing mobile navigation — is precisely the class an E2E journey test catches. The SRS even promises E2E smoke in CI.

6. **Pagination decided and not implemented.** 3 of ~60 list endpoints paginate, against an NFR saying all of them do. This becomes a breaking change to fix and a performance cliff to ignore.

7. **Unused dependencies advertising unbuilt features.** `framer-motion` and `zustand` in `package.json`, imported nowhere, while `docs/06-design-system.md` specifies a full motion system with timings per interaction.

8. **No staging environment.** `main` deploys straight to production. Every deployment bug was found by users.

9. **No error tracking.** No Sentry, no equivalent. Production errors are found when someone complains.

10. **Breadth over depth.** Sixteen module UIs, several one screen deep, while the core HR flows still had gaps that made them unusable. The PRD's MVP column existed to prevent exactly this and was not enforced against the build.

## Mistakes made — the catalogue

| # | Mistake | Commit | Root cause class |
|---|---|---|---|
| 1 | Tenant context bound after route-model binding — cross-tenant id could leak | `3132efd` | Middleware ordering |
| 2 | Two dashboard endpoints with no permission check; sidebar rendered all 25 links to everyone | `ad5342a` | Authorization coverage |
| 3 | Query on `tasks.assignee_id`, a column that does not exist → production 500 | `b3c486b` | Vacuous test + engine divergence |
| 4 | No mobile navigation at all below `lg` | `cfdd97e` | Desktop-only shell |
| 5 | iOS Safari zoom on 14px inputs; route guard blocked `/accept-invite` for session-holders | `bf9125b` | Mobile platform behaviour + guard logic |
| 6 | Task form could not set description or assignees the API accepted | `c4d764e` | API/UI drift |
| 7 | No screen could set a salary → payroll could never run | `f9d5bff` | Engine with no input path |
| 8 | Leave types seeded read-only; roles page unreachable from nav | `f9d5bff` | Missing configuration surface; missing door |
| 9 | No work-schedule editor → late detection inert for every customer | `7e51eb5` | Missing configuration surface |
| 10 | Dialogs could not scroll — 481px of content unreachable | `7e51eb5` | Shared component defect |
| 11 | Flaky test from two independently-derived dates | `7e51eb5` | Test construction |
| 12 | `/register` linked from login but never built → 404 on production | `aa9fa48` | Broken link, no route crawl |
| 13 | Slug field "swallowed" the space key | `cd3d898` | Input transformation timing |
| 14 | Duplicate department name → raw DB error, not 422; deletable with staff attached | `1097f33` | Missing guards |
| 15 | Permission shipped in a seeder → invisible in production | `929ff1b` | Platform runs migrations, not seeders |
| 16 | Four of five services had no deploy trigger → three days stale; worker missing dispatched classes | `65d4efe` | Platform assumption |
| 17 | `workflow_run` deploy checked out the branch, not the triggering commit | `f7b6ed5` | CI semantics |
| 18 | PHP `^8.2` with a lockfile needing 8.4.1 → platform chose 8.2, build failed | `a64cddd` | Loose version constraint |
| 19 | `ext-pcntl` undeclared → Reverb crashed on `SIGINT` | `3cdadad` | Undeclared native extension |
| 20 | CI ran `--parallel` without ParaTest | `b807140` | Untested CI command |
| 21 | `NEXT_PUBLIC_*` passed at runtime, silently ignored | `cba55e5` | Build-time vs runtime |
| 22 | nginx `SCRIPT_FILENAME` resolved in the wrong container | `cba55e5` | Container path assumption |
| 23 | Uploads not on a shared volume → invisible to the worker, lost on restart | `cba55e5` | Stateless-service assumption |
| 24 | Reverb service missing from the compose stack entirely | `cba55e5` | Stack not audited against features |

**The distribution is the lesson:** 5 of 24 are application logic bugs. **9 are missing UI for existing capability.** **10 are environment, platform or CI.** A methodology that focuses on "writing good code" addresses one fifth of the actual problem.

## What took the most effort

By commit count and calendar time:
1. **Deployment and CI** — 10 commits across `08-01` to `08-12`, plus two runbooks totalling 19,465 bytes. None of it was in the original plan.
2. **Closing the UI/API gap** — 6 commits on `08-04` and `08-10`, all of the "the API could always do this, no screen could" form.
3. **Mobile** — 2 substantial commits, essentially retrofitting a second platform.
4. **Getting permissions right for non-admin roles** — the security fix plus the self-service and team-view work.

Notably *not* on this list: the AI assistant, payroll tax computation, real-time chat, and billing — the four features that sound hardest. They were each one commit, built cleanly, and did not come back.

## Patterns to reuse

1. **Docs-first, with a strict MVP column called "the contract."**
2. **One module per pull request, all layers, with the test count in the commit message.**
3. **A tenancy test helper** (`createTenant`, `createUserWithRole`, `actingAsTenantUser`) that makes a correctly-scoped test three lines. Highest leverage artifact in the repo.
4. **Graceful degradation for every third-party integration**, with a named error code and a UI setup notice.
5. **Bootstrap endpoint** returning user + tenant + enabled modules + permissions + unread counts, so the client renders itself and permission logic exists once.
6. **BFF token custody** — HttpOnly cookie, server-side proxy, no CORS surface, extended even to WebSocket channel auth.
7. **Permission naming as `module.resource.action`** with a grouped picker UI generated from the catalogue.
8. **Module registry + per-tenant toggles + route middleware**, which makes per-module pricing possible and doubles as a kill switch.
9. **Versioned rule tables for anything statutory**, selected by the period being computed.
10. **Business-rule guards with explanatory refusals** — cannot delete a leave type in use, cannot complete an exit with assets outstanding, cannot delete a department with staff, typed-code confirmation for irreversible deletes.
11. **Terminate versus delete as distinct operations**, with token revocation on termination.
12. **A gotchas document** for platform behaviour, written at the moment of discovery.
13. **CI-gated deploys** that deploy the triggering commit, serialized, migrations-carrier first.
14. **Idempotent seeder wrapped in a migration** for anything that must exist as production data.

## What should never be repeated

1. **A commit nobody can review.** Cap it; split the scaffold.
2. **Writing a claim in a document you are not implementing.** Put it in a labelled aspirations section or delete it.
3. **Testing against a different database engine than production.**
4. **Shipping an engine without its input path.**
5. **Seeding configuration with no editor.**
6. **Building a shell that only works on desktop.**
7. **Adding a page with no navigation entry.**
8. **Accepting a test that would pass against an empty database.**
9. **Assuming a connected repository means automatic deployment.**
10. **Deploying straight to production with no staging environment.**
11. **Running without error tracking.**
12. **Declaring dependencies you do not use.**

## Parts that demonstrate excellent AI-assisted development

For an ebook, these are the showcase pieces:

1. **`3132efd` — the tenant-binding fix.** A subtle security bug found while building an unrelated feature, fixed in three lines of middleware priority, proved with a regression test demonstrated to fail first, and explained in a commit message a junior engineer could learn from. This is the single best example in the repository.
2. **`ad5342a` — the employee permission fix.** Model triage: separates presentation leakage from real leakage, fixes the real one at the API, gives employees a *personal dashboard* rather than a 403, makes company keys **absent rather than zeroed**, and adds a `meta.scope` marker. Shows judgement, not just correction.
3. **`6d19a98` — FCM push with no SDK.** Service-account JSON → RS256-signed JWT → cached access token → per-device send, integrated so that *every existing notification gains push with zero per-notification changes*, with dead-token pruning. Tested against faked Google endpoints asserting a real signed JWT on the wire.
4. **`2f091a9` — the AI assistant.** A bounded tool-use loop, six allowlisted permission-filtered tools, salaries and identity numbers excluded by construction, refusal handling, per-tenant token metering, and graceful `AI_NOT_CONFIGURED`. A textbook example of integrating an LLM safely into a permissioned product.
5. **`d3d35c9` — billing.** HMAC-SHA512 webhook verification with constant-time compare, idempotent activation from either webhook or callback, renewals extending from the current period end *"so paying early never loses time"*, and a 402 lock that keeps auth and billing routes reachable so an admin can sign in and pay. Seven tests including replay and underpayment.
6. **`7e51eb5` — working hours.** Best example of *root-cause* thinking: the reported symptom was "late detection doesn't work"; the cause was that no schedule could exist; the fix included seeding a sensible default at registration *"so both features work on day one instead of appearing broken."*
7. **`65d4efe` — deploy from CI.** Diagnosing a platform limitation (project tokens cannot create deploy triggers), choosing a better solution rather than fighting it, and noting the upside: *"Railway's own webhook would deploy on push regardless of whether the build was green."*

## Screenshots to capture

**For the "what we built" chapter**
- Executive dashboard, light and dark, desktop — KPI cards, charts, approvals, activity feed
- The same dashboard as a plain employee (personal scope) side by side with the admin version — the single best security teaching image in the project
- Employee list with the detail sheet open showing the tabbed personnel file
- Payroll run: draft → the per-employee gross → pension → PAYE → net breakdown, and a rendered payslip PDF
- Drag-and-drop boards: kanban, CRM pipeline, recruitment pipeline
- AI assistant mid-conversation showing tool-use badges
- Attendance today board and the clock-in widget with geofence status
- Settings → Roles: the grouped permission picker
- Settings → Branding: live preview with a custom palette applied
- Platform console: workspaces, plans, trials
- Mobile: the drawer open at 390px, the dashboard's two-up stat tiles, a scrollable table

**For the "process" chapter**
- The commit graph showing 22 PRs
- A single feature PR's file list — migration through test — as the anatomy of a slice
- Full text of `3132efd`'s commit message
- The CI run: API tests + web build, green
- The Railway deploy workflow run showing api-first ordering and service polling
- The five-service Railway topology
- Test output: 149 tests passing

**For the "what went wrong" chapter**
- Before/after of the unscrollable dialog (annotated with the 1,247px / 766px measurements)
- Before/after of mobile navigation: nothing versus the drawer
- The 404 on `/register` in production
- The 500 on the personal dashboard, with the Postgres error
- The employee seeing admin navigation (before) versus the filtered navigation (after)
- The failed Railway build showing PHP 8.2 selected
- The stale-service state: `api` at commit X, `worker` three days behind
- A screenshot of the security doc's PHPStan claim next to the CI file that has no PHPStan step

## Prompts to preserve

Reconstruct and preserve, in this priority order:
1. The **documentation-suite prompt** that produced eleven internally consistent documents in one pass — the highest-value prompt in the project.
2. The **module slice prompt** used ~20 times. Its consistency is visible in the output: every module has the same shape. Reconstructing it exactly is the core asset of a prompt library.
3. The **live verification prompt** — whatever produced "verified live end-to-end through the web BFF" and the iPhone-viewport measurements.
4. The **security review prompt** behind `ad5342a`, which produced a *triage* rather than a patch.
5. The **stack audit prompt** behind `cba55e5` — "audit the compose stack against the shipped features" found four latent production failures at once.
6. The **debugging prompts** for the platform failures, showing how the platform was interrogated rather than guessed at.
7. The **regression-test-first prompt** behind `3132efd`.

**RECOMMENDATION:** going forward, save the prompt in the pull request description. The commit records the output; nothing currently records the input, and the input is the product you intend to sell.

## Errors to document

The 24-row table above is the raw material. For teaching, group them into six named lessons, each with its real error text, root cause and fix:

1. **The Vacuous Test** (`b3c486b`) — a test that cannot fail
2. **The Unreachable Feature** (`f9d5bff`, `c4d764e`, `7e51eb5`) — capability with no input path
3. **The Invisible Permission** (`929ff1b`) — seeders do not run on deploy
4. **The Stale Service** (`65d4efe`) — connected is not the same as triggered
5. **The Build-Time Variable** (`cba55e5`) — runtime env silently ignored
6. **The Ordering Bug** (`3132efd`) — middleware priority as a security control

## Before/after examples worth building the book around

| # | Before | After | Teaches |
|---|---|---|---|
| 1 | Employee sees company headcount, all 25 nav links | Personal dashboard, filtered nav, company keys absent with `meta.scope` | Authorization is a payload-shape decision, not a UI decision |
| 2 | Test asserts a count of 0 against an empty table | Test creates an open, a done and a colleague's task; asserts exactly 1 | What a real test looks like |
| 3 | Payroll: *"no active employees with a salary were found"* | Salary section with allowances and live monthly gross | Engine + input path in the same slice |
| 4 | No navigation on mobile | Slide-in drawer from the same permission-filtered config | Mobile is not a viewport, it is a shell |
| 5 | 1,247px of dialog content in a 766px window | `overflow-y: auto` on the Dialog component | Fix shared components, not call sites |
| 6 | Permission in a seeder, absent in production | Idempotent seeder wrapped in a migration | Know what your platform runs |
| 7 | Four services three days behind `main` | CI-driven deploy, api first, polled to green | Verify the trigger exists |
| 8 | `"php": "^8.2"`, build fails | `"php": "^8.4"`, `ext-pcntl` declared | Pin what the lockfile needs |
| 9 | Security doc claims PHPStan L8, gitleaks, Trivy, RLS | *(not yet fixed)* — the drift audit | Documents must be enforced or labelled |
| 10 | 14px inputs, iOS zooms the page | 16px below `sm`, 40px touch height | Platform behaviour is a requirement |

---

# 22. Facts, Recommendations, and Unknowns

As requested, the three categories separated.

## 22.1 FACTS OBSERVED FROM THE PROJECT

**Repository and process**
- 73 commits, 22 merged pull requests, 2026-07-31 → 2026-08-12; every commit co-authored by Claude, all feature work via PR on `claude/*` branches.
- The root commit is the documentation suite (13 files, 1,174 insertions), before any application code.
- Commit 2 is 184 files / 25,616 insertions containing both the Laravel API skeleton and the entire Next.js design system.
- 20 consecutive vertical-slice feature commits at 1,000–1,800 insertions each, each reporting a running test count.
- Commit messages state symptom, root cause, mechanism, verification and deferred work.
- 17 of 73 commits are bug fixes; 10 are deployment/CI.

**Scale**
- API: 14,546 lines PHP (app + routes + migrations + config). Web: 16,410 lines TS/TSX. Tests: 5,199 lines. Docs: 1,562 lines.
- 60 Eloquent models, 17 module directories, 10 service classes, 34 migrations, 34 permissions, 41 test files, 149 test methods.
- `apps/mobile` contains 3 files — a scaffold, not an app.

**Stack** — PHP 8.4 / Laravel 12 / PostgreSQL 16 / Redis 7 / Next.js 16.2.12 / React 19.2.4 / TypeScript 5 / Tailwind v4 / Radix / TanStack Query v5 / React Hook Form + Zod / Recharts / Laravel Reverb + laravel-echo + pusher-js / dompdf / google2fa / Socialite / flysystem-s3.

**Architecture as built** — modular monolith; shared-database multi-tenancy with `tenant_id`, a global ORM scope, auto-fill on create, and explicit middleware priority binding tenant context before route-model binding; Next.js BFF with an HttpOnly cookie so the browser never holds an API token, extended to WebSocket channel auth; `module.resource.action` permissions enforced by `requirePermission()` on a base controller; per-tenant module toggles gating route groups; a bootstrap endpoint driving client rendering.

**Architecture as documented but not built** — per-module FormRequests (0 exist; 82 inline validations), Resources, Repositories (0), DTOs, Policies (0), Events/Listeners per module, per-module route files (0), per-module migration directories (0); models are flat in `app/Models`.

**Integrations** — Anthropic Claude (Messages API tool loop, 6 permission-filtered tools, token metering), Paystack (HMAC-SHA512 webhooks, idempotent activation), FCM HTTP v1 (no SDK, RS256 JWT, dead-token pruning), Google/Microsoft/GitHub OAuth (sign-in only, one-time exchange codes), SMTP, S3/R2. All degrade gracefully when unconfigured.

**Deployment** — Railway, five services (`api`, `worker`, `scheduler`, `reverb`, `web`) plus Postgres and Redis plugins, real IDs committed in `services.json`; deploys from GitHub Actions after CI succeeds on `main`, serialized, api first; a documented Docker Compose + nginx + Cloudflare alternative; a tag-triggered GHCR/SSH workflow also exists.

**Testing** — 39 feature test files hitting real endpoints with real auth and seeded roles; 2 unit files including 5 PAYE tests pinned to hand-computed values; a tenancy test helper trait; third-party APIs faked faithfully; **in-memory SQLite in CI while production runs Postgres**; zero frontend tests; zero E2E tests; no coverage gate; no static analysis.

**Claimed in docs, absent from code** — Sentry, PHPStan level 8, gitleaks, Trivy, Dependabot, `composer audit`/`npm audit` in CI, PostgreSQL RLS, pgvector, Telescope, OpenAPI generation, `Idempotency-Key`, password history/expiry/breach checks, IP allowlists, device-session endpoints, ClamAV scanning, ≥80% coverage, E2E smoke in CI, an `Auditable` trait (audit is 71 explicit call sites), Horizon (plain `queue:work`), Framer Motion and Zustand (declared, never imported), pagination on all list endpoints (3 of ~60).

**The 24 documented mistakes** — see the table in §21: 5 application logic, 9 missing-UI-for-existing-capability, 10 environment/platform/CI.

## 22.2 RECOMMENDATIONS FOR THE VIBE TO PRODUCTION™ METHODOLOGY

Everything in §5–§20 is recommendation. The load-bearing items:

1. **The eleven-phase framework** (§7), with deployment moved to Phase 3, a dedicated identity/tenancy/permissions phase before features, and a hardening phase that includes a documentation-drift audit.
2. **The slice contract** — plan, approve, build, use, review, one PR (§10).
3. **The 28 AI Development Rules** (§10), of which 1, 5, 14, 15, 19, 25 and 26 prevent the most damage.
4. **The Master AI Development Prompt** (§18), kept in the repo as `CLAUDE.md`.
5. **The prompt library** (§19), 25 prompts with when/inputs/expected.
6. **The debugging workflow** ERROR → CONTEXT → INVESTIGATION → ROOT CAUSE → FIX → TEST → VERIFY, with nine worked error-class prompts (§11).
7. **The testing methodology** weighted toward feature tests, with "a test you have not seen fail is not a test" as its axiom, plus the missing E2E journey layer (§12).
8. **The production-quality checklist** (§13) and the **post-launch checklist** (§17).
9. **The twenty-step deployment journey** and the three-environment model, including the staging environment this project lacks (§15).
10. **The PRD template** (§8) with its two additions: a labelled aspirations section and an open-questions register.
11. **The ChatGPT/Claude division by information access** rather than by task type (§6).
12. **The honest beginner curriculum** (§20).

## 22.3 ASSUMPTIONS AND UNKNOWN INFORMATION

**UNKNOWN — not determinable from the repository:**
- Whether ChatGPT (or any second AI) was used at any point. No trace exists.
- The actual prompts used. Only outputs are recorded. This is the single biggest loss for the ebook.
- Whether `go3net.app` is registered, live, or currently pointed at the Railway deployment. DNS state is not in a repo.
- Whether the application currently has real paying customers or production traffic.
- Whether backups are actually running and whether a restore has ever been tested.
- Whether the documented quarterly restore drills, load tests and penetration tests have happened.
- Whether the Docker Compose / VPS deployment path is in use, or is documentation only.
- Whether the tag-triggered `deploy.yml` (GHCR + SSH) is used at all.
- How much human editing was applied to AI output — the diffs record the result, not the authorship split.
- Total wall-clock hours. Twelve calendar days is a fact; hours worked is not.
- Whether nginx actually sets the security headers the security doc claims (the config file was not exhaustively audited in this analysis).
- Whether the Flutter app has been developed anywhere outside this repository.
- Whether the mobile-viewport verification claims were manual or automated.

**ASSUMPTIONS made in this analysis, stated explicitly:**
- That commit messages accurately describe what happened. They are unusually detailed and internally consistent, and where they were checkable against diffs they checked out — but they remain self-reported.
- That the repository at `main` reflects what is deployed. Reasonable given CI-driven deploys, unverifiable from here.
- That "verified live" claims are true. Consistent with the specificity of the measurements quoted.
- That HR was the original product and the platform grew around it. Inferred from the repository name and HR's disproportionate depth. Not stated anywhere.
- That the same person or small team drove the whole project. All commits are authored by one identity.

---

# 23. Recommended Ebook Structure

**RECOMMENDATION.** Built to sell on the evidence you already have, and to be teachable without the reader having your repository.

## Part I — The Promise and the Trap (3 chapters, ~30 pages)
1. **What AI actually changed** — the twelve-day, 30,000-line platform, and the nine of twelve days spent on things nobody plans for. Set expectations honestly in chapter one; it is the most credible thing you can do.
2. **The four kinds of failure** — logic bugs (rare), unreachable features (common), environment surprises (constant), and drift (invisible). The 24-mistake table as the book's spine.
3. **Vibe coding versus VIBE TO PRODUCTION™** — the distinction the whole book monetizes: prototypes are easy; the last mile is the product.

## Part II — Before You Write Code (4 chapters, ~50 pages)
4. **Idea to wedge** — interrogation, personas as jobs, non-goals.
5. **The PRD that acts as a contract** — with the template, and the aspirations-section lesson from this project's security doc.
6. **From PRD to architecture** — the ten decisions to make before volume, each illustrated by this repository.
7. **Deploy an empty app** — Phase 3, and the five platform surprises it would have caught cheaply.

## Part III — Building (5 chapters, ~80 pages)
8. **The design system and the shell** — including "mobile is a shell, not a viewport."
9. **Identity, tenancy, permissions** — with the middleware-ordering bug as the centrepiece.
10. **The slice loop** — the workhorse chapter. Anatomy of one real PR, file by file.
11. **Staying in control** — the 28 rules, with the evidence for each.
12. **Testing that would actually catch it** — the vacuous test versus the proven-to-fail test.

## Part IV — Making It Real (4 chapters, ~60 pages)
13. **Debugging** — the workflow plus the nine error classes with real errors from this project.
14. **From works to production quality** — the checklist, and the ten before/after examples.
15. **Deployment, twenty steps** — the pipeline diagram and every gotcha.
16. **Domain, DNS and TLS for people who have never done it** — the beginner chapter that will be screenshotted and shared.

## Part V — After Launch (2 chapters, ~30 pages)
17. **Operating it** — monitoring, backups, restores, rollbacks, the post-launch checklist.
18. **Managing the AI relationship over time** — the repo instruction file, the drift audit, keeping discipline when the pressure is to ship.

## Part VI — The Toolkit (appendices, ~50 pages)
- A. The Master AI Development Prompt (single page, designed to be copied)
- B. The Prompt Library, 25 prompts
- C. The PRD template
- D. The production-quality checklist
- E. The deployment checklist and env-var inventory template
- F. The post-launch checklist
- G. The AI Development Rules, one page
- H. **Case study: Go3net Office** — the full annotated history, the 24 mistakes, the seven showcase commits

## Companion products
- **Prompt library** as a searchable web app or Notion database — the highest-margin product here.
- **Course**: 6 modules mirroring Parts I–VI, each ending in a real deliverable the student ships. Module 3 (the slice loop) is the one people will pay for.
- **Template repository**: monorepo scaffold with the tenancy kernel, test helper trait, BFF pattern, permission catalogue, CI with the correct database engine, staging environment, drift-audit job, and the `CLAUDE.md` master prompt pre-installed. This is the most defensible asset — it encodes the methodology as working code.
- **Audit service**: run the §7 Phase 7 hardening pass on someone else's AI-built codebase. Every finding class in this document generalizes.

## The three positioning claims the evidence supports
1. *"AI can build a real multi-tenant SaaS platform in under two weeks."* — demonstrable.
2. *"Three quarters of the failures are not in the code."* — 19 of 24 documented mistakes were missing UI or environment/platform issues.
3. *"The discipline is small, specific, and teachable."* — a handful of rules, one prompt file, and a checklist prevent almost all of it.

---

*Document ends. Analysis performed against `go3net/hr` at branch `claude/vibe-to-production-methodology-2up13x`, base commit `4a2abf3`. No application code, configuration, or existing documentation was modified in producing it.*
