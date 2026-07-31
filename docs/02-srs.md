# Go3net Office — Software Requirements Specification (SRS)

**Version:** 1.0 · Conforms to IEEE 830 structure (abridged)

## 1. Introduction

### 1.1 Purpose
Defines functional and non-functional requirements for the Go3net Office platform (API, web app, mobile app).

### 1.2 Definitions
- **Tenant** — one customer organization; all business data is tenant-scoped.
- **Module** — a toggleable functional domain (HR, Projects, CRM, …).
- **Actor** — a user holding one or more roles within a tenant.

## 2. Overall Description

- **System of systems:** Laravel 12 REST API (system of record) + Next.js 15 web client + Flutter mobile client + queue workers + scheduler.
- **Interfaces:** REST/JSON over HTTPS; WebSockets (Laravel Reverb) for chat/presence/notifications; S3-compatible object storage; SMTP/FCM/SMS/WhatsApp providers; OAuth (Google, Microsoft, GitHub); Paystack/Stripe billing webhooks.

## 3. Functional Requirements

Requirement IDs: `FR-<module>-<n>`. Priority: M (must), S (should), C (could).

### 3.1 Identity & Access (AUTH)
- FR-AUTH-1 (M): Register tenant with company name, subdomain, admin user; email verification required.
- FR-AUTH-2 (M): Login via email+password; issue Sanctum token (mobile) or secure session cookie (web).
- FR-AUTH-3 (M): OAuth login: Google, Microsoft, GitHub; auto-link by verified email.
- FR-AUTH-4 (M): TOTP two-factor auth; recovery codes; per-tenant policy to enforce 2FA.
- FR-AUTH-5 (M): Password policy (min length, complexity, expiry, reuse history) configurable per tenant.
- FR-AUTH-6 (M): Session/device management: list active devices, revoke any session.
- FR-AUTH-7 (S): IP allowlist per tenant; block logins outside allowed CIDRs.
- FR-AUTH-8 (M): RBAC — system roles (Super Admin, CEO, HR Manager, Department Manager, Finance, Project Manager, Team Lead, Employee, NYSC Corps Member, Intern, Guest) + custom roles composed of granular permissions (`module.resource.action`).
- FR-AUTH-9 (M): Every state-changing request writes an audit log row (actor, tenant, action, entity, before/after diff, IP, user agent).

### 3.2 Tenancy & Modules (TEN)
- FR-TEN-1 (M): All business tables carry `tenant_id`; queries are automatically tenant-scoped; cross-tenant access is impossible at the ORM layer.
- FR-TEN-2 (M): Tenant admin can enable/disable modules; disabled module routes return 403 `MODULE_DISABLED` and hide in navigation.
- FR-TEN-3 (M): Subscription plans gate module availability and seat counts; billing lifecycle: trial → active → past_due → suspended → cancelled.
- FR-TEN-4 (S): White-label: custom logo, brand colors, custom domain, email sender identity (Enterprise plan).

### 3.3 HR Management (HRM)
- FR-HRM-1 (M): Employee profile with digital personnel file: bio-data, passport photo, CV, certificates, NIN, BVN, bank details, emergency contacts, guarantors, medical info, employment history, promotions, disciplinary records. Sensitive fields (NIN, BVN, bank, medical) encrypted at rest and permission-gated.
- FR-HRM-2 (M): Departments and positions; org hierarchy (manager chains); full-text employee search.
- FR-HRM-3 (M): Attendance: clock-in/out via GPS (with geofence radius per office), QR code (rotating per-office code), web; flags late arrival / early departure against work schedules; analytics.
- FR-HRM-4 (M): Leave: configurable types (annual, sick, compassionate, study, maternity, paternity, custom), accrual balances, multi-step approval workflow (Team Lead → Dept Manager → HR), team calendar, conflict warnings.
- FR-HRM-5 (M): Onboarding: generate offer letter, employment contract, NDA from templates with merge fields; checklist (asset assignment, email, ID card); e-signature capture.
- FR-HRM-6 (M): Payroll: salary structures (basic + allowances), bonuses, deductions, loans with repayment schedules; monthly payroll run with preview → approve → publish payslips; Nigerian PAYE tax and pension computation (versioned rule tables); bank transfer export (CSV/Excel per bank format).
- FR-HRM-7 (M): Assets: registry (laptops, phones, keys, monitors, SIMs, licenses, accessories), assign/return with condition notes, history, QR/barcode labels.
- FR-HRM-8 (M): Exit: resignation/termination workflow, exit interview form, asset return clearance, final settlement, generate experience/recommendation letters.
- FR-HRM-9 (S): Recruitment: job postings, public career portal, application pipeline (applied → screening → interview → offer → hired), interview scheduling + scorecards, offer letter generation, candidate database, email notifications.
- FR-HRM-10 (S): Performance: quarterly review cycles, monthly KPIs, OKRs with key results, manager + peer feedback, performance graphs, promotion recommendations.

### 3.4 Projects & Tasks (PRJ/TSK)
- FR-PRJ-1 (M): Projects with members, status, budget; views: Kanban, list, calendar; milestones.
- FR-PRJ-2 (S): Sprints, timeline (Gantt), task dependencies (blocks/blocked-by), time tracking entries.
- FR-TSK-1 (M): Tasks: title, rich description, assignees, priority, deadline, subtasks, comments (mentions), attachments, activity log, recurring rules.
- FR-TSK-2 (M): Personal ("My Tasks") and department task boards; notifications on assignment, mention, due-soon.

### 3.5 CRM (CRM)
- FR-CRM-1 (M): Leads with sources and owners; convert to client; deals with pipeline stages (drag-and-drop), values, expected close.
- FR-CRM-2 (S): Follow-up reminders; activity timeline (calls, emails, notes); proposals; link to Finance invoices; WhatsApp/email send via adapters.

### 3.6 Finance (FIN)
- FR-FIN-1 (M): Income and expense records with categories, receipts (file), approval for expenses.
- FR-FIN-2 (M): Invoices: line items, tax, discounts; statuses draft→sent→partial→paid→overdue; PDF generation; payment records (Paystack/Stripe/manual).
- FR-FIN-3 (S): Purchase orders, budgets per department/category with utilization, cash-flow report, charts.

### 3.7 Inventory (INV)
- FR-INV-1 (S): Products (SKU, barcode), suppliers, warehouses, stock levels, stock movements (in/out/transfer/adjust), low-stock alerts, purchase orders.

### 3.8 LMS (LMS)
- FR-LMS-1 (S): Courses → modules → lessons (video, text, file); enrollment; progress tracking; quizzes with auto-grading; completion certificates; instructor dashboard.

### 3.9 Documents (DOC)
- FR-DOC-1 (M): Folder tree per tenant; upload to S3; preview (image/PDF); share with users/roles/departments; permission levels view/edit/manage.
- FR-DOC-2 (S): Version history; approval workflow; tags; OCR-extracted text into search index.

### 3.10 Chat (CHT)
- FR-CHT-1 (M): 1:1 and group conversations; real-time via WebSockets; typing indicators; mentions; file sharing; reactions; unread counts; announcements channel (post: admins only).
- FR-CHT-2 (S): Voice notes (record, upload, inline playback).

### 3.11 Knowledge Base (KB)
- FR-KB-1 (M): Articles (policies, FAQs, tutorials, SOPs, wiki) with rich text, categories, search; view analytics.

### 3.12 Help Desk (HD)
- FR-HD-1 (M): Tickets: subject, body, priority, department routing, assignee, statuses; SLA timers per priority; email notifications; internal notes vs public replies; KB article suggestions.

### 3.13 Calendar (CAL)
- FR-CAL-1 (M): Unified calendar: company events, meetings, approved leave, birthdays, project deadlines; personal vs company visibility.
- FR-CAL-2 (S): Google Calendar and Outlook two-way sync (OAuth).

### 3.14 AI Assistant (AI)
- FR-AI-1 (M): Chat assistant grounded on tenant data (RBAC-filtered retrieval): answer HR questions, natural-language search across employees/documents/KB.
- FR-AI-2 (M): Generate documents (offer letters, contracts, policies, emails, reports) from context + templates.
- FR-AI-3 (S): Summarize meetings, analyze performance data, suggest promotions, parse resumes into candidate records.
- FR-AI-4 (C): Attrition prediction, performance prediction, voice commands.

### 3.15 Notifications & Reports (NTF/RPT)
- FR-NTF-1 (M): Notification center (in-app), email, push (FCM); SMS/WhatsApp via provider adapters; per-user channel preferences per event type.
- FR-RPT-1 (M): Module reports (attendance, payroll, performance, projects, finance, recruitment, training, assets, leave) exportable to PDF, Excel, CSV; async generation via queue with download link.

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | P95 API latency < 250 ms; P99 < 600 ms at 1,000 RPS |
| NFR-2 | Web LCP < 1.5 s, CLS < 0.1, INP < 200 ms on mid-range Android over 3G-fast |
| NFR-3 | 99.9% monthly uptime; RPO ≤ 15 min; RTO ≤ 1 h |
| NFR-4 | Horizontal scalability: stateless API pods; workers scale by queue depth |
| NFR-5 | Security: OWASP ASVS L2; TLS 1.2+; AES-256 at rest for sensitive columns; annual pentest |
| NFR-6 | Accessibility WCAG 2.1 AA; full keyboard navigation; visible focus states |
| NFR-7 | Observability: Sentry (errors), Telescope (dev), Horizon (queues), structured JSON logs, health endpoints |
| NFR-8 | All list endpoints paginated (cursor preferred); rate limiting per token/IP |
| NFR-9 | Test coverage: ≥ 80% on services/policies; E2E smoke on critical flows in CI |
| NFR-10 | Data residency roadmap: region-pinned storage per tenant (v2) |

## 5. Constraints
- PHP 8.4 / Laravel 12; PostgreSQL 16+; Redis 7+; Node 22 / Next.js 15; Flutter 3.x.
- Deployed on Docker behind NGINX + Cloudflare; CI/CD via GitHub Actions.

## 6. Acceptance Criteria (MVP gate)
1. Tenant signup → onboarding → invite employees → employees clock in via GPS/QR → leave request approved → payroll run published → payslip visible on mobile: complete E2E without manual intervention.
2. All FR items marked (M) in §3.1–3.4, 3.9–3.15 implemented and covered by feature tests.
3. Lighthouse ≥ 90 performance / ≥ 95 accessibility on dashboard, employees, and login pages.
