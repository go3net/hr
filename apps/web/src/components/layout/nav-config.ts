"use client";

import type * as React from "react";
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
  ShieldCheck,
  Palette,
  CreditCard,
} from "lucide-react";
import { useBootstrap } from "@/hooks/use-api";

export type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  name: string;
  permission?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

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
export const NAV: NavGroup[] = [
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
  {
    label: "Administration",
    items: [
      {
        href: "/settings/roles",
        icon: ShieldCheck,
        name: "Roles & permissions",
        permission: "settings.roles.manage",
      },
      {
        href: "/settings/branding",
        icon: Palette,
        name: "Branding",
        permission: "settings.branding.manage",
      },
      {
        href: "/settings/billing",
        icon: CreditCard,
        name: "Billing & plan",
        permission: "settings.billing.manage",
      },
    ],
  },
];

/**
 * The nav this member may actually use. Returns an empty list until the
 * session loads rather than the full menu — flashing admin links at an
 * employee, even briefly, is the thing being avoided.
 */
export function useVisibleNav(): { groups: NavGroup[]; workspaceName: string; logo: boolean } {
  const { data: session } = useBootstrap();
  const branding = session?.tenant?.branding;
  const permissions = session?.permissions ?? [];
  const enabledModules = new Set((session?.modules ?? []).filter((m) => m.enabled).map((m) => m.key));

  const groups = session
    ? NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const moduleKey = MODULE_OF[item.href];
          if (moduleKey && !enabledModules.has(moduleKey)) return false;
          if (!item.permission) return true;
          return permissions.includes("*") || permissions.includes(item.permission);
        }),
      })).filter((group) => group.items.length > 0)
    : [];

  return {
    groups,
    workspaceName: branding?.display_name ?? "Go3net Office",
    logo: Boolean(branding?.logo_path),
  };
}
