# Go3net Office — Database Schema & ERD

PostgreSQL 16. Conventions: `bigint` identity PKs, `uuid public_id` for API exposure, `tenant_id` FK on every business table (indexed, part of most composite indexes), `created_at/updated_at`, soft deletes (`deleted_at`) on user-facing entities. Sensitive columns (marked 🔒) are AES-256 encrypted via Laravel encrypted casts.

## 1. Core ERD (identity, tenancy, RBAC, billing)

```mermaid
erDiagram
    TENANTS ||--o{ USERS : has
    TENANTS ||--o{ TENANT_MODULES : enables
    MODULES ||--o{ TENANT_MODULES : "toggled by"
    TENANTS ||--o| SUBSCRIPTIONS : has
    PLANS ||--o{ SUBSCRIPTIONS : "subscribed via"
    USERS ||--o{ USER_ROLES : holds
    ROLES ||--o{ USER_ROLES : "assigned by"
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "granted by"
    USERS ||--o{ SESSIONS_DEVICES : "signs in on"
    USERS ||--o{ AUDIT_LOGS : performs
    USERS ||--o{ NOTIFICATIONS : receives

    TENANTS {
        bigint id PK
        uuid public_id
        string name
        string subdomain UK
        string custom_domain
        jsonb branding
        jsonb settings
        string status
    }
    USERS {
        bigint id PK
        bigint tenant_id FK
        string email UK
        string password
        string two_factor_secret
        jsonb two_factor_recovery_codes
        string provider "google|microsoft|github|null"
        string provider_id
        timestamp last_login_at
        string status
    }
    ROLES {
        bigint id PK
        bigint tenant_id FK "null = system role"
        string key
        string name
        boolean is_system
    }
    PERMISSIONS {
        bigint id PK
        string key UK "module.resource.action"
    }
```

## 2. HR ERD

```mermaid
erDiagram
    DEPARTMENTS ||--o{ EMPLOYEES : contains
    POSITIONS ||--o{ EMPLOYEES : "held by"
    EMPLOYEES ||--o| EMPLOYEES : "reports to"
    USERS ||--o| EMPLOYEES : "is"
    EMPLOYEES ||--o{ EMPLOYEE_DOCUMENTS : files
    EMPLOYEES ||--o{ EMERGENCY_CONTACTS : lists
    EMPLOYEES ||--o{ GUARANTORS : lists
    EMPLOYEES ||--o{ EMPLOYMENT_EVENTS : "history of"
    EMPLOYEES ||--o{ ATTENDANCE_RECORDS : clocks
    OFFICES ||--o{ ATTENDANCE_RECORDS : at
    WORK_SCHEDULES ||--o{ EMPLOYEES : governs
    LEAVE_TYPES ||--o{ LEAVE_REQUESTS : typed
    EMPLOYEES ||--o{ LEAVE_REQUESTS : requests
    LEAVE_REQUESTS ||--o{ LEAVE_APPROVALS : "approved via"
    EMPLOYEES ||--o{ LEAVE_BALANCES : accrues
    EMPLOYEES ||--o{ PAYROLL_ITEMS : "paid via"
    PAYROLL_RUNS ||--o{ PAYROLL_ITEMS : contains
    EMPLOYEES ||--o{ ASSET_ASSIGNMENTS : uses
    ASSETS ||--o{ ASSET_ASSIGNMENTS : "assigned via"
    EMPLOYEES ||--o| EMPLOYEE_EXITS : "exits via"

    EMPLOYEES {
        bigint id PK
        bigint tenant_id FK
        bigint user_id FK
        bigint department_id FK
        bigint position_id FK
        bigint manager_id FK
        string employee_code
        string first_name
        string last_name
        string phone
        date date_of_birth
        string gender
        string marital_status
        string address
        string nin "🔒"
        string bvn "🔒"
        string bank_name "🔒"
        string bank_account_number "🔒"
        string pension_pin "🔒"
        text medical_notes "🔒"
        string employment_type "full_time|contract|nysc|intern"
        date hired_at
        string status "active|on_leave|suspended|exited"
        numeric base_salary
        jsonb allowances
        string photo_path
    }
    ATTENDANCE_RECORDS {
        bigint id PK
        bigint tenant_id FK
        bigint employee_id FK
        bigint office_id FK
        date work_date
        timestamp clocked_in_at
        timestamp clocked_out_at
        string method "gps|qr|web|biometric"
        point in_location
        point out_location
        boolean is_late
        boolean left_early
        int minutes_late
    }
    LEAVE_REQUESTS {
        bigint id PK
        bigint tenant_id FK
        bigint employee_id FK
        bigint leave_type_id FK
        date start_date
        date end_date
        numeric days
        text reason
        string status "pending|approved|rejected|cancelled"
    }
    PAYROLL_RUNS {
        bigint id PK
        bigint tenant_id FK
        string period "YYYY-MM"
        string status "draft|preview|approved|published"
        numeric gross_total
        numeric net_total
        timestamp published_at
    }
    PAYROLL_ITEMS {
        bigint id PK
        bigint payroll_run_id FK
        bigint employee_id FK
        numeric basic
        jsonb allowances
        jsonb deductions
        numeric paye_tax
        numeric pension_employee
        numeric gross
        numeric net
        string payslip_path
    }
```

## 3. Work management ERD (projects, tasks)

```mermaid
erDiagram
    PROJECTS ||--o{ PROJECT_MEMBERS : staffs
    PROJECTS ||--o{ MILESTONES : tracks
    PROJECTS ||--o{ TASKS : contains
    TASKS ||--o{ TASKS : "subtask of"
    TASKS ||--o{ TASK_ASSIGNEES : "worked by"
    TASKS ||--o{ TASK_DEPENDENCIES : "blocked by"
    TASKS ||--o{ COMMENTS : discussed
    TASKS ||--o{ ATTACHMENTS : holds
    TASKS ||--o{ TIME_ENTRIES : logs
    SPRINTS ||--o{ TASKS : schedules

    TASKS {
        bigint id PK
        bigint tenant_id FK
        bigint project_id FK "null = standalone"
        bigint parent_id FK
        bigint sprint_id FK
        string title
        text description
        string status "todo|in_progress|review|done"
        string priority "low|medium|high|urgent"
        date due_date
        jsonb recurrence
        int position "board order"
    }
```

## 4. Remaining domains (summary)

| Domain | Tables |
|---|---|
| CRM | `leads`, `clients`, `deals`, `pipeline_stages`, `crm_activities`, `follow_ups`, `proposals` |
| Finance | `finance_categories`, `transactions` (income/expense), `invoices`, `invoice_items`, `invoice_payments`, `purchase_orders`, `budgets` |
| Inventory | `products`, `suppliers`, `warehouses`, `stock_levels`, `stock_movements` |
| LMS | `courses`, `course_modules`, `lessons`, `enrollments`, `lesson_progress`, `quizzes`, `quiz_questions`, `quiz_attempts`, `certificates` |
| Documents | `folders`, `documents`, `document_versions`, `document_shares`, `document_approvals`, `tags`, `taggables` |
| Chat | `conversations`, `conversation_participants`, `messages`, `message_reactions`, `message_reads` |
| Knowledge | `kb_categories`, `kb_articles`, `kb_article_views` |
| Help Desk | `tickets`, `ticket_replies`, `sla_policies` |
| Calendar | `events`, `event_attendees`, `calendar_connections` (Google/Outlook OAuth) |
| Recruitment | `job_postings`, `candidates`, `applications`, `application_stages`, `interviews`, `interview_scorecards`, `offers` |
| Performance | `review_cycles`, `reviews`, `kpis`, `kpi_entries`, `okr_objectives`, `okr_key_results`, `feedback` |
| AI | `ai_conversations`, `ai_messages`, `ai_usage_logs`, `document_templates`, `generated_documents` |
| Billing | `plans`, `subscriptions`, `subscription_invoices`, `payment_methods`, `usage_records` |
| System | `audit_logs`, `notifications`, `notification_preferences`, `webhooks`, `api_keys`, `report_exports`, `ip_restrictions`, `password_histories` |

## 5. Indexing & integrity strategy

- Composite indexes lead with `tenant_id`: e.g. `(tenant_id, status)`, `(tenant_id, work_date, employee_id)` unique on attendance, `(tenant_id, period)` unique on payroll runs.
- Full-text: `tsvector` generated columns on employees (name/code/email), documents (OCR text), KB articles, tasks; GIN indexes. pgvector planned for AI retrieval (v2).
- FKs `ON DELETE RESTRICT` for financial/audit data, `CASCADE` only for pure children (e.g. invoice_items).
- Row-Level Security enabled on 🔒-bearing tables with `tenant_id = current_setting('app.tenant_id')::bigint` policy as defense-in-depth.
- Monthly partitioning candidates at scale: `attendance_records`, `audit_logs`, `messages`, `ai_usage_logs`.
