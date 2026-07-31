# Go3net Office — Security Documentation

Target posture: OWASP ASVS Level 2; SOC 2 Type II readiness on the roadmap.

## 1. Identity & Access
- **Authentication:** Argon2id password hashing; Sanctum tokens (mobile, scoped abilities) + HttpOnly `SameSite=Lax` secure session cookies (web). OAuth (Google/Microsoft/GitHub) links only verified emails.
- **2FA:** TOTP (RFC 6238) + one-time recovery codes (hashed). Tenants can enforce 2FA for all users or specific roles.
- **Password policy (per tenant):** min length (default 10), complexity, expiry days, reuse history (`password_histories`), breach check against known-compromised list on set.
- **Sessions & devices:** every login recorded (device, IP, UA, geo); users and admins can revoke; absolute session lifetime + idle timeout configurable.
- **IP restrictions:** per-tenant CIDR allowlist enforced in middleware before auth.
- **RBAC:** permissions are `module.resource.action` strings; roles are permission sets; Laravel Policies check permissions + record-level rules (e.g. manager sees only own department's sensitive data). Deny by default.

## 2. Tenant Isolation
- Global ORM scope (`TenantScope`) + auto-fill on create; cross-tenant IDs 404, never 403 (no existence leaks).
- PostgreSQL Row-Level Security on sensitive tables keyed to `app.tenant_id` session variable — a second, database-enforced wall.
- Object storage keys prefixed per tenant; presigned URLs short-lived (5 min) and content-disposition-forced.
- Cache/queue keys tenant-prefixed; workers rebind tenant context from job payload.

## 3. Data Protection
- **In transit:** TLS 1.2+ everywhere (Cloudflare edge + origin certs); HSTS preload.
- **At rest:** disk encryption (provider) + column-level AES-256-GCM (Laravel encrypted casts) for NIN, BVN, bank details, pension PIN, medical notes, 2FA secrets, OAuth tokens, API keys.
- **Key management:** `APP_KEY` in secret manager; rotation runbook (re-encrypt job); per-env keys never shared.
- **PII lifecycle:** data export (tenant admin), erasure workflow honoring NDPR/GDPR; exited-employee retention policy configurable (default 7 years for payroll records, statutory).

## 4. Application Security
- All input via FormRequest validation; Eloquent bindings (no raw SQL without bindings); output encoding by default (API is JSON; web escapes via React).
- File uploads: extension + MIME sniff + size caps; images re-encoded; stored outside web root in S3; AV scan hook (ClamAV) on the queue.
- CSRF protection on cookie-based routes; CORS locked to tenant domains.
- Rate limiting: login 10/min/IP with progressive lockout + notification; API 60/min/user.
- Security headers via NGINX: CSP (strict, nonce-based on web app), X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy.
- Secrets: never in repo; GitHub Actions OIDC → secret manager; Telescope disabled in production; debug mode hard-off in prod.
- Dependencies: Dependabot + `composer audit` / `npm audit` in CI; images scanned (Trivy) before deploy.

## 5. Audit & Monitoring
- Immutable `audit_logs` (append-only; no update/delete grants): actor, tenant, action, entity type/id, before→after diff (sensitive fields redacted), IP, UA, request-id.
- Auth events (login, failed login, 2FA, password change, role change, module toggle, payroll publish) always audited and alertable.
- Sentry for exceptions; anomaly alerts: spike in 401/403, logins from new countries, mass export.

## 6. Incident Response (summary)
1. Detect (alerting) → 2. Triage severity (S1 data breach … S4 minor) → 3. Contain (revoke tokens, block IPs, disable tenant/feature flag) → 4. Eradicate & recover (patch, restore) → 5. Notify affected tenants within 72 h where legally required (NDPR/GDPR) → 6. Post-mortem within 5 business days, action items tracked.

## 7. Secure SDLC
- Branch protection + mandatory review; CI gates: static analysis (PHPStan level 8, ESLint, TypeScript strict), tests, dependency + secret scanning (gitleaks).
- Annual external penetration test; quarterly internal review of permission matrix; threat model updated per new module.
