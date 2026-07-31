# Go3net Office — API Reference (v1)

Base URL: `https://api.go3net.app/v1` · All responses JSON. OpenAPI spec is generated from code annotations (see `apps/api` — `php artisan l5-swagger:generate` planned; this document is the canonical contract for v1 core).

## Conventions

- **Auth:** `Authorization: Bearer <token>` (Sanctum personal access token — mobile/API) or session cookie (web SPA). Tenant resolved from subdomain or `X-Tenant: <subdomain>` header.
- **Envelope:**
  ```json
  { "data": …, "meta": { "pagination": { "cursor": "…", "per_page": 25 } } }
  ```
  Errors: `{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": { … } } }`
- **Status codes:** 200/201/204 success · 401 unauthenticated · 403 forbidden (incl. `MODULE_DISABLED`, `SUBSCRIPTION_INACTIVE`) · 404 · 409 conflict · 422 validation · 429 rate-limited.
- **Pagination:** `?cursor=…&per_page=25` (max 100). **Filtering:** `?filter[status]=active&filter[department_id]=3`. **Sorting:** `?sort=-created_at`. **Search:** `?q=`.
- **Idempotency:** mutating endpoints accept `Idempotency-Key` header (stored 24 h).
- **Rate limits:** 60 req/min per user default; 600 req/min per tenant; auth endpoints 10/min per IP.

## Endpoints (core)

### Auth & Session
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create tenant + admin user `{company, subdomain, name, email, password}` |
| POST | `/auth/login` | Email/password → token or session; returns `{two_factor: true}` when 2FA required |
| POST | `/auth/two-factor` | Verify TOTP/recovery code |
| POST | `/auth/logout` | Revoke current token/session |
| GET | `/auth/oauth/{google\|microsoft\|github}/redirect` | OAuth start |
| GET | `/auth/oauth/{provider}/callback` | OAuth complete |
| POST | `/auth/forgot-password` / `/auth/reset-password` | Reset flow |
| GET | `/me` | Current user + employee profile |
| GET | `/me/bootstrap` | User, tenant, enabled modules, permissions, unread counts |
| GET | `/me/sessions` · DELETE `/me/sessions/{id}` | Device management |
| POST | `/me/two-factor/enable` · `/confirm` · `/disable` | 2FA lifecycle |

### Tenant, Modules, Roles
| Method | Path | Description |
|---|---|---|
| GET/PATCH | `/tenant` | Tenant profile, branding, settings |
| GET | `/modules` | Catalog with per-tenant enabled state |
| PATCH | `/modules/{key}` | Enable/disable `{enabled: bool}` (plan-gated) |
| GET/POST | `/roles` · GET/PATCH/DELETE `/roles/{id}` | Custom roles |
| GET | `/permissions` | Permission catalog |
| POST | `/users/{id}/roles` | Assign roles |
| GET | `/audit-logs` | Filterable audit trail |

### HR — Employees
| Method | Path | Description |
|---|---|---|
| GET/POST | `/hr/employees` | List (search, filters) / create (optionally invite user account) |
| GET/PATCH/DELETE | `/hr/employees/{id}` | Profile; sensitive fields require `hr.employees.view_sensitive` |
| GET/POST | `/hr/employees/{id}/documents` | Personnel file (passport, CV, certificates…) |
| GET/POST | `/hr/employees/{id}/emergency-contacts` · `/guarantors` | Related records |
| GET | `/hr/employees/{id}/history` | Employment events (hire, promotion, discipline…) |
| GET/POST | `/hr/departments` · `/hr/positions` · `/hr/offices` | Org structure (CRUD via `/{id}`) |

### HR — Attendance
| Method | Path | Description |
|---|---|---|
| POST | `/hr/attendance/clock-in` | `{method, latitude?, longitude?, qr_token?, office_id?}` — validates geofence/QR |
| POST | `/hr/attendance/clock-out` | Close today's record |
| GET | `/hr/attendance` | Records (filters: employee, date range, late) |
| GET | `/hr/attendance/today` | Live board: present/absent/late |
| GET | `/hr/attendance/stats` | Analytics aggregates |
| GET | `/hr/offices/{id}/qr` | Current rotating QR token (HR only) |

### HR — Leave
| Method | Path | Description |
|---|---|---|
| GET/POST | `/hr/leave-types` | Configurable types + entitlements |
| GET/POST | `/hr/leave-requests` | List / submit request |
| POST | `/hr/leave-requests/{id}/approve` · `/reject` · `/cancel` | Workflow actions (step-aware) |
| GET | `/hr/leave-balances?employee_id=` | Balances per type |
| GET | `/hr/leave-calendar?month=` | Team calendar overlay |

### HR — Payroll, Assets, Exit (contract summary)
`/hr/payroll/runs` (POST create draft → POST `/{id}/preview` → `/approve` → `/publish`), `/hr/payroll/runs/{id}/items`, `/hr/payroll/runs/{id}/bank-export`, `/hr/payslips/mine` · `/hr/assets` CRUD, `/hr/assets/{id}/assign` · `/return` · `/hr/exits` workflow endpoints.

### Dashboard
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | Widget stats: staff, departments, attendance today, projects, pending leave/approvals, payroll month, birthdays, new employees |
| GET | `/dashboard/charts?range=` | Time-series: headcount, attendance rate, expenses vs revenue |
| GET | `/dashboard/activity` | Latest activity feed |
| GET | `/dashboard/insights` | AI-generated insights (cached daily) |

### Other modules (route prefixes)
`/projects`, `/tasks`, `/crm/{leads,clients,deals,pipelines}`, `/finance/{transactions,invoices,budgets}`, `/inventory/…`, `/lms/…`, `/documents`, `/chat/{conversations,messages}`, `/kb/articles`, `/helpdesk/tickets`, `/calendar/events`, `/ai/{chat,generate,search}`, `/notifications`, `/reports/{key}/export`, `/billing/{plans,subscription,invoices}` — each guarded by its module flag and permissions, following the same conventions.

## Webhooks (outbound)

Tenant-configurable endpoints receive signed (`X-Go3net-Signature`, HMAC-SHA256) events: `employee.created`, `leave.approved`, `payroll.published`, `invoice.paid`, `ticket.created`, etc. Retries with exponential backoff ×5.
