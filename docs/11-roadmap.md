# Go3net Office — Roadmap & Module Status

Status of this repository against the full product scope. ✅ implemented here · 🏗️ scaffolded/partial · 📋 designed (docs/schema) · ⬜ planned.

## Platform Foundation
| Capability | Status | Notes |
|---|---|---|
| Monorepo (api / web / mobile / infra / docs) | ✅ | |
| Multi-tenant core (TenantScope, resolver, context) | ✅ | Shared-DB row scoping; RLS documented |
| Auth: register tenant, login, Sanctum tokens | ✅ | |
| 2FA (TOTP), OAuth Google/Microsoft/GitHub | ✅ | Enroll/confirm/challenge with single-use recovery codes; OAuth sign-in via one-time exchange codes (set provider credentials in .env) |
| RBAC (system roles, permissions, policies) | ✅ | Custom roles CRUD next |
| Module registry + per-tenant toggles + middleware | ✅ | |
| Audit logging | ✅ | Trait + writer on state changes |
| Notifications (in-app + email) | ✅ | Bell center + queued mail; FCM push/SMS/WhatsApp adapters next |
| Billing & subscriptions | ✅ | Paystack checkout + signed webhooks, 3-plan catalog, 14-day trial, renewal-preserving period extension, 402 lock on expiry (billing/auth stay reachable), payment history UI. Per-plan seat limits + proration next |
| White-label branding | 📋 | |

## Modules
| # | Module | Status | Notes |
|---|---|---|---|
| 1 | Dashboard | ✅ | Summary stats API + executive UI (KPIs, charts, feeds) |
| 2 | HR: employees, departments, positions, offices | ✅ | Digital personnel file fields incl. encrypted NIN/BVN/bank |
| 2 | HR: attendance (GPS geofence, QR, late detection) | ✅ | Biometric/face = integration points |
| 2 | HR: leave (types, balances, approval workflow) | ✅ | |
| 2 | HR: payroll | ✅ | Versioned PAYE tables (NTA 2026 + legacy CRA), pension, draft→approve→publish runs, payslip PDFs, adjustments, bank export CSV |
| 2 | HR: onboarding docs, assets, exit | 📋 | |
| 2 | HR: recruitment ATS | ✅ | Openings with slots/departments, drag-and-drop applicant pipeline (applied→screening→interview→offer→hired/rejected), star ratings, hire action that creates the employee record. CV uploads + interview scheduling next |
| 2 | HR: performance (OKR) | ✅ | Objectives with measurable key results, capped-average progress, check-ins, mine/team scopes (hr.performance.view/manage). Review cycles + appraisal forms next |
| 3 | Projects (kanban, milestones) | ✅ | Projects, members, milestones schema, drag-and-drop board. Sprints/Gantt/dependencies next |
| 4 | Tasks | ✅ | Personal + project tasks, priorities, comments, my-tasks view. Recurring rules next |
| 5 | CRM | ✅ | Leads → convert, clients, drag-and-drop deal pipeline with stage stats, activities/follow-ups. Proposals, WhatsApp/email send next |
| 6 | Finance | ✅ | Income/expenses with approval, invoices (line items, tax, numbering) with payments and auto-posted income, month summary. POs, budgets, cash-flow charts next |
| 7 | Inventory | 📋 | |
| 8 | LMS | 📋 | |
| 9 | Documents | ✅ | Folders, uploads (S3-ready), tenant/private visibility, sharing, search, downloads. Versions/OCR/approvals next |
| 10 | Chat (Reverb) | ✅ | Direct + group chat, unread tracking, real-time delivery: Echo/WebSocket client over Reverb with BFF-proxied channel auth (token never reaches the browser), 45s polling as reconnect fallback. Typing indicators, reactions, voice notes next |
| 11 | Knowledge Base | ✅ | Markdown articles with draft→publish, per-tenant slugs, categories, search, view counts; published articles ground the AI assistant via search_knowledge_base. Rich-text editor + attachments next |
| 12 | Help Desk | ✅ | Per-tenant ticket numbering (HD-0001), priorities/categories, assignment, status flow with resolved/closed stamps, threaded replies with agent-only internal notes, requester/agent notifications. SLA timers + email-in next |
| 13 | Calendar | ✅ | Events with attendees + RSVP, company-wide events (calendar.manage), invite notifications, multi-day support, .ics export for Google/Outlook import, month-grid UI. Recurrence + two-way Google/Outlook OAuth sync next |
| 14 | AI Assistant | ✅ | Claude-powered chat grounded via permission-aware tenant tools (employees, leave, attendance, projects, pipeline, finance), document drafting (offer letters, contracts, policies, memos), per-tenant usage metering. Set ANTHROPIC_API_KEY to enable. Conversation persistence + knowledge-base grounding next |

## Frontend
| Capability | Status |
|---|---|
| Design system (tokens, dark/light/system, Inter) | ✅ |
| App shell (sidebar, topbar, command palette) | ✅ |
| Auth pages (login) | ✅ |
| Executive dashboard | ✅ |
| HR: employees list + detail | ✅ |
| HR: leave + attendance pages | ✅ |
| Remaining module UIs | ⬜ follow established patterns |

## Mobile
Flutter scaffold with architecture doc — feature build-out follows API stabilization.

## Suggested next sprints
1. Inventory + LMS to complete the extended module set.
2. HR round-out: onboarding checklists, asset assignment, exit workflows.
3. FCM push notifications (mobile + web).
4. Flutter mobile feature build-out against the stabilized API.
