"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBootstrap } from "@/hooks/use-api";
import {
  LayoutDashboard,
  Users,
  Users2,
  UserRound,
  Building2,
  IdCard,
  Clock,
  CalendarDays,
  Banknote,
  BriefcaseBusiness,
  Target,
  ClipboardList,
  Laptop,
  FolderKanban,
  CheckSquare,
  HeartHandshake,
  Wallet,
  Boxes,
  GraduationCap,
  FileText,
  MessageSquare,
  BookOpen,
  LifeBuoy,
  Calendar,
  Sparkles,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

// A disabled module hides its pages for everyone, admins included.
const MODULE_OF: Record<string, string> = {
  "/dashboard": "dashboard",
  "/profile": "hr",
  "/hr/team": "hr",
  "/hr/employees": "hr",
  "/hr/departments": "hr",
  "/hr/positions": "hr",
  "/hr/attendance": "hr",
  "/hr/leave": "hr",
  "/hr/payroll": "hr",
  "/hr/recruitment": "hr",
  "/hr/performance": "hr",
  "/hr/onboarding": "hr",
  "/hr/assets": "hr",
  "/projects": "projects",
  "/tasks": "tasks",
  "/crm": "crm",
  "/finance": "finance",
  "/inventory": "inventory",
  "/lms": "lms",
  "/documents": "documents",
  "/chat": "chat",
  "/knowledge": "knowledge",
  "/helpdesk": "helpdesk",
  "/calendar": "calendar",
  "/assistant": "ai",
};

// `permission` gates the link: omit it for pages every member may open
// (their own profile, leave, payslips, chat). The API enforces the same
// rules — this only keeps people from being shown doors they cannot open.
const nav = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", icon: LayoutDashboard, name: "Dashboard" }],
  },
  {
    label: "People",
    items: [
      { href: "/profile", icon: UserRound, name: "My profile" },
      { href: "/hr/team", icon: Users2, name: "My team", permission: "hr.team.view" },
      { href: "/hr/employees", icon: Users, name: "Employees", permission: "hr.employees.view" },
      { href: "/hr/departments", icon: Building2, name: "Departments", permission: "hr.departments.view" },
      { href: "/hr/positions", icon: IdCard, name: "Positions", permission: "hr.departments.manage" },
      { href: "/hr/attendance", icon: Clock, name: "Attendance" },
      { href: "/hr/leave", icon: CalendarDays, name: "Leave" },
      { href: "/hr/payroll", icon: Banknote, name: "Payroll" },
      { href: "/hr/recruitment", icon: BriefcaseBusiness, name: "Recruitment", permission: "hr.recruitment.manage" },
      { href: "/hr/performance", icon: Target, name: "Performance" },
      { href: "/hr/onboarding", icon: ClipboardList, name: "Onboarding", permission: "hr.employees.manage" },
      { href: "/hr/assets", icon: Laptop, name: "Assets", permission: "hr.assets.manage" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/projects", icon: FolderKanban, name: "Projects", permission: "projects.view" },
      { href: "/tasks", icon: CheckSquare, name: "Tasks" },
      { href: "/crm", icon: HeartHandshake, name: "CRM", permission: "crm.view" },
      { href: "/finance", icon: Wallet, name: "Finance", permission: "finance.view" },
      { href: "/inventory", icon: Boxes, name: "Inventory", permission: "inventory.view" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/lms", icon: GraduationCap, name: "Training" },
      { href: "/documents", icon: FileText, name: "Documents" },
      { href: "/chat", icon: MessageSquare, name: "Chat" },
      { href: "/knowledge", icon: BookOpen, name: "Knowledge" },
      { href: "/helpdesk", icon: LifeBuoy, name: "Help desk" },
      { href: "/calendar", icon: Calendar, name: "Calendar" },
      { href: "/assistant", icon: Sparkles, name: "AI assistant" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useBootstrap();
  const branding = session?.tenant?.branding;
  const workspaceName = branding?.display_name ?? "Go3net Office";

  const permissions = session?.permissions ?? [];
  const enabledModules = new Set((session?.modules ?? []).filter((m) => m.enabled).map((m) => m.key));

  // Until the session loads we render nothing rather than the full menu —
  // flashing admin links at an employee is the bug this guards against.
  const visible = session
    ? nav
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const moduleKey = MODULE_OF[item.href];
            if (moduleKey && !enabledModules.has(moduleKey)) return false;
            if (!item.permission) return true;
            return permissions.includes("*") || permissions.includes(item.permission);
          }),
        }))
        .filter((group) => group.items.length > 0)
    : [];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
        {branding?.logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant logo streams through the authenticated BFF
          <img
            src="/api/backend/settings/branding/logo"
            alt={workspaceName}
            className="size-7 rounded-lg object-contain"
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-[13px] font-bold text-white">
            {workspaceName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{workspaceName}</span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visible.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors duration-150",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 h-4 w-0.5 rounded-full bg-primary" />
                      )}
                      <item.icon className="size-[18px]" strokeWidth={1.75} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-[18px]" strokeWidth={1.75} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
