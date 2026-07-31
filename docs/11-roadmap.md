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
| Billing & subscriptions | 📋 | Schema + plan gating designed |
| White-label branding | 📋 | |

## Modules
| # | Module | Status | Notes |
|---|---|---|---|
| 1 | Dashboard | ✅ | Summary stats API + executive UI (KPIs, charts, feeds) |
| 2 | HR: employees, departments, positions, offices | ✅ | Digital personnel file fields incl. encrypted NIN/BVN/bank |
| 2 | HR: attendance (GPS geofence, QR, late detection) | ✅ | Biometric/face = integration points |
| 2 | HR: leave (types, balances, approval workflow) | ✅ | |
| 2 | HR: payroll | ✅ | Versioned PAYE tables (NTA 2026 + legacy CRA), pension, draft→approve→publish runs, payslips, bank export CSV. Payslip PDFs next |
| 2 | HR: onboarding docs, assets, exit | 📋 | |
| 2 | HR: recruitment ATS, performance (KPI/OKR) | 📋 | |
| 3 | Projects (kanban, milestones) | ✅ | Projects, members, milestones schema, drag-and-drop board. Sprints/Gantt/dependencies next |
| 4 | Tasks | ✅ | Personal + project tasks, priorities, comments, my-tasks view. Recurring rules next |
| 5 | CRM | 📋 | |
| 6 | Finance | 📋 | |
| 7 | Inventory | 📋 | |
| 8 | LMS | 📋 | |
| 9 | Documents | 📋 | |
| 10 | Chat (Reverb) | 📋 | |
| 11 | Knowledge Base | 📋 | |
| 12 | Help Desk | 📋 | |
| 13 | Calendar | 📋 | |
| 14 | AI Assistant | 📋 | Gateway design + flows documented |

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
1. Payslip PDF generation (queued) + payroll adjustments (bonuses, loans, one-off deductions).
2. OAuth + 2FA wiring; notifications (email templates + FCM).
3. Projects/Tasks module APIs + kanban UI (pattern already set by HR).
4. Chat via Reverb; Documents on S3.
5. Billing (Paystack first) to enable monetization.
6. AI assistant v1 (grounded Q&A + document generation).
