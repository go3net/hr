# Go3net Office — UI/UX Design System

Inspiration: Linear, Notion, Stripe Dashboard, Vercel, Framer, Apple, Arc, Clerk. The feel: calm, spacious, precise, premium. Never "admin template".

## 1. Color Tokens

Semantic tokens (CSS custom properties, implemented in `apps/web/src/app/globals.css`) with light and dark values:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#F8FAFC` | `#0B1220` | App canvas |
| `--surface` | `#FFFFFF` | `#111A2E` | Cards, panels |
| `--surface-elevated` | `#FFFFFF` | `#16213B` | Popovers, modals |
| `--border` | `#E2E8F0` | `#1F2A44` | Hairlines |
| `--foreground` | `#0F172A` | `#F1F5F9` | Primary text |
| `--muted-foreground` | `#64748B` | `#94A3B8` | Secondary text |
| `--primary` | `#2DA9DD` | `#2DA9DD` | Brand actions |
| `--primary-foreground` | `#FFFFFF` | `#062A3B` | Text on primary |
| `--secondary` | `#1E293B` | `#E2E8F0` | Secondary emphasis |
| `--accent` | `#00C2FF` | `#00C2FF` | Highlights, gradients, focus glow |
| `--success` | `#22C55E` | `#34D399` | Positive |
| `--warning` | `#F59E0B` | `#FBBF24` | Caution |
| `--danger` | `#EF4444` | `#F87171` | Destructive |

Brand gradient: `linear-gradient(135deg, #2DA9DD, #00C2FF)` — reserved for hero moments (login panel, empty states, primary CTA hover glow), never body backgrounds.

Status pills use 10%-alpha token backgrounds with solid token text (e.g. success pill: `bg: rgb(34 197 94 / .12)`, `text: #16A34A`).

## 2. Typography — Inter (self-hosted via next/font)

| Style | Size/Line | Weight | Tracking |
|---|---|---|---|
| Display | 30/36 | 600 | -0.02em |
| H1 (page title) | 24/32 | 600 | -0.02em |
| H2 (section) | 18/28 | 600 | -0.01em |
| H3 (card title) | 15/24 | 600 | -0.01em |
| Body | 14/22 | 400 | 0 |
| Body-strong | 14/22 | 500 | 0 |
| Small / meta | 13/20 | 400 | 0 |
| Micro / overline | 11/16 | 500 | +0.06em uppercase |
| Numeric (KPIs) | 28/34 | 600 | -0.02em, `font-variant-numeric: tabular-nums` |

## 3. Spacing, Radius, Elevation

- **Spacing scale:** 4-px base — 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Page gutters 24 (mobile 16); card padding 20–24; section gaps 32.
- **Radius:** inputs/buttons 10px (`--radius: 0.625rem`), cards 14px, modals 16px, pills 999px.
- **Shadows (light):**
  - `sm` `0 1px 2px rgb(15 23 42 / .06)` — resting cards
  - `md` `0 4px 12px rgb(15 23 42 / .08)` — hover, dropdowns
  - `lg` `0 12px 32px rgb(15 23 42 / .12)` — modals, command palette
  - Dark mode relies on surface steps + 1px borders, shadows at 40% opacity.
- **Glassmorphism (sparingly):** topbar & command palette — `backdrop-blur(12px)` over `surface/80`; never on data tables.

## 4. Motion (Framer Motion)

| Pattern | Spec |
|---|---|
| Micro feedback (hover/press) | 120–150 ms, ease-out; press scale 0.98 |
| Enter (cards, rows, popovers) | 180–220 ms, opacity + 8px y-translate, ease-out; stagger lists 30 ms/item, cap 8 |
| Modals / sheets | 220 ms scale 0.97→1 + fade; overlay fade 150 ms |
| Page transitions | 150 ms crossfade only — navigation must feel instant |
| Numbers (KPIs) | count-up 400 ms on first paint |
| Respect `prefers-reduced-motion` | all non-essential motion disabled |

## 5. Core Components (shadcn/ui, re-themed)

Button (primary / secondary / ghost / destructive / outline; sm 32 · md 36 · lg 40), Input + Field (label 13/500, 8px gap, error text danger 13), Select, Combobox, DatePicker, Card (StatCard, ChartCard, ListCard), DataTable (sticky header, 44px rows, hover `muted/50`, checkbox select, column sort, empty + skeleton states), Dialog/Sheet/Drawer, Tabs (underline style), Badge/StatusPill, Avatar (+stack), Tooltip, Toast (bottom-right, 4 s), CommandPalette (⌘K — global nav + actions + AI ask), Sidebar (collapsible 264→72px, active item: primary/10 bg + primary text + 2px left indicator), Topbar (breadcrumbs, search, notifications bell, theme toggle, avatar menu), EmptyState (icon in gradient-tinted circle, title, body, CTA), Skeleton (shimmer 1.4 s).

**Iconography:** Lucide only, 20px default (16px dense), stroke 1.75, `muted-foreground` default.

## 6. Layout Grid

- App shell: fixed sidebar (264px desktop, overlay on <1024px), topbar 56px, content max-width 1440px centered, 24px gutters.
- Dashboard grid: 12-col, KPI cards 3-col each (min 240px), charts 6-col, feeds 4/8 split.
- Forms: single column, max 640px; two-column only for short related pairs.

## 7. Interaction & Accessibility Rules

- Every interactive element: visible focus ring (`2px accent/60` offset 2px), 44px minimum touch target on mobile.
- Navigation renders instantly with skeletons — no full-page spinners, ever.
- Destructive actions: confirm dialog with typed-name confirmation for irreversible ones (delete employee, publish payroll).
- All colors pass WCAG AA against their backgrounds (verified in token table).
- Tables → cards on mobile; primary actions bottom-sticky on mobile forms.
- Optimistic UI for: task moves, reactions, chat send, toggles; rollback with toast on failure.

## 8. Content Voice

Sentence case everywhere ("Add employee", not "Add Employee"). Empty states teach ("No leave requests yet — requests you submit will appear here"). Errors say what to do next. Dates humanized ("Today, 9:14 AM"; "Mar 4" beyond 7 days). Currency with narrow no-break space: `₦ 1,250,000`.

## 9. Screen Blueprints (wireframe contracts)

- **Login:** split screen — left: form card on `background`; right: brand gradient panel with product screenshot + tagline. Mobile: form only.
- **Dashboard:** greeting header ("Good morning, Amaka") + date + AI insight strip → 4 KPI stat cards → charts row (attendance area chart, headcount by department bar) → 3-col: pending approvals list, birthdays/events, activity feed.
- **Employees:** header (title, count pill, search, filters, "Add employee" primary) → DataTable (avatar+name, code, department, position, status pill, hired date, row menu) → detail = full-height sheet with tabs (Profile, Documents, Attendance, Leave, Payroll, Assets, History).
- **Attendance:** today board (present/late/absent summary + live table) | records tab | analytics tab; clock-in widget shows map + geofence status.
- **Leave:** my balance cards → requests table → request sheet (type, range picker w/ working-days calc, reason) → approvals inbox for managers with one-click approve/reject.
- **Kanban:** columns 320px, cards (title, pill, assignee stack, due chip), drag with 2° tilt + `lg` shadow, column virtualized beyond 50.
