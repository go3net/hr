# Go3net Office — Product Requirements Document (PRD)

**Version:** 1.0 · **Owner:** Go3net Technologies Ltd · **Status:** Approved for build

---

## 1. Vision

Go3net Office is the central operating system for organizations across Africa and beyond — SMEs, schools, NGOs, churches, startups, and enterprises. It replaces a patchwork of tools (BambooHR + Monday + Slack + QuickBooks + Google Admin) with one modular, AI-native, mobile-first platform that feels as premium as Linear, Stripe, and Notion.

**One-line pitch:** *Run your entire organization — people, projects, money, knowledge — from one beautiful workspace.*

## 2. Goals & Success Metrics

| Goal | Metric | Target (12 months post-GA) |
|---|---|---|
| Adoption | Active tenants | 1,000 paying organizations |
| Engagement | Weekly active users / seats | ≥ 70% |
| Performance | P95 API latency | < 250 ms |
| Performance | Largest Contentful Paint | < 1.5 s |
| Reliability | Uptime | 99.9% |
| Revenue | Net revenue retention | ≥ 110% |
| Quality | NPS | ≥ 50 |

## 3. Target Customers & Personas

- **CEO / Founder (Amaka)** — wants a single executive dashboard: headcount, cash, attendance, project health, AI insights. Checks from phone.
- **HR Manager (Tunde)** — runs recruitment → onboarding → attendance → leave → payroll → exit. Needs Nigerian compliance (NIN, BVN, PAYE, pension) and document generation.
- **Department Manager / Team Lead (Sarah)** — approves leave, assigns tasks, tracks KPIs and OKRs.
- **Employee / Corps Member / Intern (David)** — clocks in via GPS/QR, requests leave, views payslips, chats, completes training. Mobile-first.
- **Finance Officer (Grace)** — invoices, expenses, budgets, payroll runs, bank export files.
- **IT / Super Admin (Emeka)** — tenant settings, modules, roles, security policies, audit logs, integrations.

## 4. Competitive Positioning

| Competitor | Their weakness | Go3net Office advantage |
|---|---|---|
| BambooHR / Zoho People | HR-only, dated UX, weak African localization | Full business OS, NIN/BVN/PAYE-native, modern UI |
| Monday / ClickUp / Asana | Projects-only, no HR/payroll/finance | Unified data model across modules |
| Odoo / OrangeHRM | Heavy, ugly, hard to self-serve | Premium Linear/Stripe-grade UX, instant onboarding |
| Notion / Slack / Teams | Docs/chat only, no operations backbone | Chat + docs built on top of real HR/finance data |
| Google Workspace Admin | Identity only | Full workforce lifecycle with SSO into Google/Microsoft |

**Differentiators:** modular pricing (pay per module), AI-native workflows, offline-capable mobile, white-label, Africa-first compliance, world-class design.

## 5. Product Principles

1. **Premium by default** — every screen designed before coded; no admin-template aesthetics.
2. **Fast** — sub-second perceived interactions; optimistic UI; skeletons, never spinners on navigation.
3. **Modular** — every module can be toggled per tenant; modules talk via APIs and events.
4. **AI-native** — AI is embedded in flows (drafting, summarizing, predicting), not bolted on.
5. **Mobile-first** — every employee-facing flow works one-handed on a low-end Android phone, offline.
6. **Secure & auditable** — RBAC, audit trails, encryption everywhere; enterprise trust from day one.

## 6. Modules (MVP scope → Full scope)

| # | Module | MVP (v1.0) | Full (v2.x) |
|---|---|---|---|
| 1 | Dashboard | Executive widgets, charts, activity feed | AI insights, custom widget builder |
| 2 | HR Management | Employee profiles + digital personnel file, departments, attendance (GPS/QR/geofence), leave workflows, onboarding docs, payroll, assets, exit | Recruitment ATS, performance (KPI/OKR/reviews), biometric/face integrations, career portal |
| 3 | Projects | Kanban, list, milestones, comments, attachments | Timeline/Gantt, sprints, dependencies, time tracking, budgets |
| 4 | Tasks | Personal & department tasks, priorities, deadlines, recurring | Automations, activity analytics |
| 5 | CRM | Leads, clients, deals, pipeline | Proposals, invoicing link, WhatsApp/Email integration |
| 6 | Finance | Income/expenses, invoices, reports | POs, budgets, cash-flow forecasting |
| 7 | Inventory | Products, suppliers, stock, alerts | Warehouses, transfers, barcode |
| 8 | Training/LMS | Courses, lessons, progress | Quizzes, certificates, instructor dashboard |
| 9 | Documents | Folders, upload, share, permissions | Versioning, approvals, OCR, tags |
| 10 | Chat | 1:1 + group chat, mentions, files | Voice notes, announcements, reactions |
| 11 | Knowledge Base | Policies, SOPs, wiki, search | AI-answered Q&A over KB |
| 12 | Help Desk | Tickets, priorities, SLA | Live chat, KB deflection |
| 13 | Calendar | Company events, birthdays, leave overlay | Google/Outlook 2-way sync |
| 14 | AI Assistant | Chat over company data, document generation, report summaries | Attrition prediction, performance prediction, voice, resume parsing |

## 7. Cross-Cutting Requirements

- **Multi-tenancy:** shared database, tenant-scoped rows, tenant-scoped storage prefixes; subdomain per tenant (`acme.go3net.app`); white-label custom domains on Enterprise.
- **Roles:** Super Admin, CEO, HR Manager, Department Manager, Finance, Project Manager, Team Lead, Employee, NYSC Corps Member, Intern, Guest + custom roles with granular permissions.
- **Notifications:** in-app, email, push (FCM), SMS and WhatsApp via provider adapters (Termii/Twilio).
- **Reports:** every module exports PDF / Excel / CSV.
- **Localization:** currency (NGN default, multi-currency), time zones, English first (i18n-ready).
- **Accessibility:** WCAG 2.1 AA.
- **Themes:** Light, Dark, System.

## 8. Monetization

| Plan | Price (per user/month) | Includes |
|---|---|---|
| Starter | Free (≤ 5 users) | Dashboard, HR-lite, Tasks |
| Growth | $3 | + Projects, Leave, Attendance, Chat, KB |
| Business | $6 | + Payroll, CRM, Finance, Help Desk, LMS, Documents |
| Enterprise | Custom | + White-label, SSO/SAML, custom domain, audit exports, SLA, dedicated support |

Add-ons: AI Assistant credits, SMS/WhatsApp bundles, extra storage. Billing via Paystack (Africa) and Stripe (global); subscription engine in-platform with proration, trials (14 days), dunning.

## 9. Non-Goals (v1)

- On-premise deployment (cloud-only at launch; containerized so it remains possible).
- Native desktop apps (responsive web + PWA cover it).
- Accounting general ledger / audited financial statements (Finance module is operational, not a replacement for audit-grade accounting yet).

## 10. Release Plan

- **v0.5 (Alpha, +3 months):** Auth, tenants, HR core (employees, departments, attendance, leave), dashboard, web app.
- **v0.8 (Beta, +6 months):** Payroll, projects, tasks, chat, documents, mobile app beta, billing.
- **v1.0 (GA, +9 months):** CRM, finance, help desk, KB, calendar sync, AI assistant v1, white-label.
- **v2.x:** LMS full, inventory full, predictive AI, marketplace/plugins.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Scope breadth dilutes quality | Module flags let us ship narrow and deep; MVP column above is the contract |
| Payroll compliance errors | Rule-engine per country, versioned tax tables, dry-run payroll preview |
| Low-bandwidth users | Offline mobile, aggressive caching, <150KB critical JS budget per route |
| AI cost overrun | Metered credits, model routing (small models for classification, large for generation) |
