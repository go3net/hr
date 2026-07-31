# Go3net Office — User Flow Diagrams

## 1. Tenant Signup & Onboarding
```mermaid
flowchart TD
    A[Landing page] --> B[Sign up: company, subdomain, admin details]
    B --> C[Email verification]
    C --> D[Onboarding wizard]
    D --> D1[Company profile & branding]
    D1 --> D2[Choose modules]
    D2 --> D3[Create departments & positions]
    D3 --> D4[Invite employees CSV / email]
    D4 --> E[Dashboard - 14-day trial active]
    E --> F{Trial ends}
    F -->|Subscribes| G[Active tenant]
    F -->|No payment| H[Grace period → read-only → suspended]
```

## 2. Employee Clock-In (GPS / QR)
```mermaid
flowchart TD
    A[Open mobile app] --> B{Method}
    B -->|GPS| C[Capture location]
    C --> D{Inside office geofence?}
    D -->|Yes| E[Create attendance record]
    D -->|No| F[Show distance + deny / flag remote request]
    B -->|QR| G[Scan office QR]
    G --> H{Token valid & fresh?}
    H -->|Yes| E
    H -->|No| I[Error: expired code]
    E --> J{After schedule start + grace?}
    J -->|Yes| K[Mark late, notify manager]
    J -->|No| L[On time]
    K --> M[Confirmation + today summary]
    L --> M
    subgraph Offline
    C -.->|No network| O[Queue locally with timestamp+GPS] -.-> P[Sync when online]
    end
```

## 3. Leave Request & Approval
```mermaid
flowchart TD
    A[Employee: New leave request] --> B[Pick type + date range]
    B --> C[System: working-days calc + balance check + team conflicts]
    C -->|Insufficient balance| X[Blocked with explanation]
    C -->|OK| D[Submit → status pending]
    D --> E[Notify approver step 1: Team Lead]
    E --> F{Decision}
    F -->|Reject| G[Status rejected + reason → notify employee]
    F -->|Approve| H{More steps?}
    H -->|Yes| I[Next approver: Dept Manager / HR] --> F
    H -->|No| J[Status approved]
    J --> K[Deduct balance · add to team calendar · notify employee]
```

## 4. Payroll Run
```mermaid
flowchart TD
    A[HR: Create run for period] --> B[System drafts items: salary structure + attendance + loans + bonuses]
    B --> C[Preview: per-employee gross → PAYE → pension → net]
    C --> D{HR adjustments?}
    D -->|Edit items| C
    D -->|OK| E[Submit for approval]
    E --> F{Finance/CEO approves?}
    F -->|No| C
    F -->|Yes| G[Publish]
    G --> H[Queue: generate payslip PDFs]
    G --> I[Bank export file]
    G --> J[Notify employees: payslip ready]
```

## 5. Recruitment Pipeline
```mermaid
flowchart LR
    A[Job posting] --> B[Career portal application]
    B --> C[Applied] --> D[Screening] --> E[Interview]
    E --> F[Scorecards] --> G{Decision}
    G -->|Offer| H[Offer letter generated + sent]
    H -->|Accepted| I[Convert to employee → onboarding checklist]
    G -->|Reject| J[Regret email, stays in candidate DB]
```

## 6. AI Assistant Query
```mermaid
flowchart TD
    A[User asks: 'Who is on leave next week?'] --> B[Classify intent - small model]
    B --> C[Retrieve: RBAC-filtered query over leave/employees/KB]
    C --> D[Ground + generate answer - large model]
    D --> E[Answer with linked records]
    E --> F[Log usage + deduct AI credits]
```

## 7. Help Desk Ticket
```mermaid
flowchart TD
    A[User creates ticket] --> B[Auto-route by department + priority]
    B --> C[SLA timer starts] --> D[Agent assigned]
    D --> E{Reply / resolve}
    E -->|Needs info| F[Waiting on user] --> E
    E -->|Resolved| G[User confirms or auto-close 72h]
    C -->|Breach imminent| H[Escalate to manager]
```
