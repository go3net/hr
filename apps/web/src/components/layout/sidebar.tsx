"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBootstrap } from "@/hooks/use-api";
import {
  LayoutDashboard,
  Users,
  Building2,
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

const nav = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", icon: LayoutDashboard, name: "Dashboard" }],
  },
  {
    label: "People",
    items: [
      { href: "/hr/employees", icon: Users, name: "Employees" },
      { href: "/hr/departments", icon: Building2, name: "Departments" },
      { href: "/hr/attendance", icon: Clock, name: "Attendance" },
      { href: "/hr/leave", icon: CalendarDays, name: "Leave" },
      { href: "/hr/payroll", icon: Banknote, name: "Payroll" },
      { href: "/hr/recruitment", icon: BriefcaseBusiness, name: "Recruitment" },
      { href: "/hr/performance", icon: Target, name: "Performance" },
      { href: "/hr/onboarding", icon: ClipboardList, name: "Onboarding" },
      { href: "/hr/assets", icon: Laptop, name: "Assets" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/projects", icon: FolderKanban, name: "Projects" },
      { href: "/tasks", icon: CheckSquare, name: "Tasks" },
      { href: "/crm", icon: HeartHandshake, name: "CRM" },
      { href: "/finance", icon: Wallet, name: "Finance" },
      { href: "/inventory", icon: Boxes, name: "Inventory" },
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
        {nav.map((group) => (
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
